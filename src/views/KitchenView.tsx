/**
 * Sabores & Nações - KDS Cozinha & Copa (Kitchen Display System)
 * Ecrã de Alta Visibilidade e Gestão em Tempo Real de Pedidos de Comida e Pastelaria
 * Totalmente integrado com Atendimento, Bar, Caixa, Admin e Pedidos Online
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Cake,
  Clock,
  CheckCircle2,
  Check,
  AlertTriangle,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Globe,
  Bell,
  Search,
  X,
  ShieldAlert,
  ShieldCheck,
  Ban,
  UserCheck,
  RotateCcw,
  Sparkles,
  Layers,
  HelpCircle,
  Play,
  Info,
  Filter,
} from 'lucide-react';
import { AppState, store } from '../services/storage';
import { OrderItem, ItemPrepStatus, Product, User } from '../types';
import { formatTime, formatElapsed, getElapsedMinutes, playAlertSound } from '../utils/formatters';

interface KitchenViewProps {
  state: AppState;
  onSelectTab?: (tab: any) => void;
}

export type KitchenStatusFilter = 'todos' | 'novos' | 'em_preparacao' | 'pronto' | 'historico' | 'cancelados';
export type KitchenOriginFilter = 'todas' | 'sala' | 'esplanada' | 'site';

export interface KitchenTicket {
  id: string;
  isOnline: boolean;
  comandaId?: string;
  comandaNumber: string;
  tableName: string;
  roomName: string;
  roundNumber: number;
  roundCreatedAt: string;
  waiterName: string;
  guestCount?: number;
  items: OrderItem[];
  allRoundItemsCount: number;
  kitchenAlertedAt?: string;
  kitchenAcknowledgedAt?: string;
  kitchenAcknowledgedBy?: string;
  allergies: string[];
  cancelledItems: OrderItem[];
  hasDeliveredAll: boolean;
  overallStatus: 'novos' | 'em_preparacao' | 'pronto' | 'historico' | 'cancelados' | 'parcial';
}

export const KitchenView: React.FC<KitchenViewProps> = ({ state }) => {
  const { comandas, onlineOrders, currentUser, settings, products } = state;

  // Filtros
  const [statusFilter, setStatusFilter] = useState<KitchenStatusFilter>('todos');
  const [subSectorFilter, setSubSectorFilter] = useState<'todos' | 'cozinha' | 'pastelaria'>('todos');
  const [originFilter, setOriginFilter] = useState<KitchenOriginFilter>('todas');
  const [searchQuery, setSearchQuery] = useState('');

  // Modais e Configurações
  const [unavailableModalOpen, setUnavailableModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [justNotifiedTicketId, setJustNotifiedTicketId] = useState<string | null>(null);

  // Menu de Informações e Filtros Mobile
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Confirmações de Leitura em Memória da Sessão
  const [acknowledgedAllergies, setAcknowledgedAllergies] = useState<Record<string, boolean>>({});
  const [acknowledgedCancellations, setAcknowledgedCancellations] = useState<Record<string, boolean>>({});

  // Proteção contra múltiplos cliques rápidos
  const [isProcessing, setIsProcessing] = useState(false);

  // Monitorização de novos pedidos para tocar sinal sonoro
  const prevActiveCountRef = useRef<number>(0);

  // Alternar modo ecrã inteiro para monitor de parede
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // 1. Construir Lista de Tickets a partir das Comandas (Atendimento)
  const tickets: KitchenTicket[] = [];

  for (const comanda of comandas) {
    if (comanda.status === 'cancelada') continue;

    for (const round of comanda.rounds) {
      // Filtrar apenas itens pertencentes à Cozinha ou Pastelaria
      const kitchenItems = round.items.filter((item) => {
        if (item.sector !== 'cozinha' && item.sector !== 'pastelaria') return false;
        if (subSectorFilter !== 'todos' && item.sector !== subSectorFilter) return false;
        return true;
      });

      if (kitchenItems.length === 0) continue;

      const activeItems = kitchenItems.filter((i) => i.status !== 'cancelado');
      const cancelledItems = kitchenItems.filter((i) => i.status === 'cancelado');

      // Extrair todas as alergias associadas aos itens da Cozinha nesta comanda/ronda
      const allergiesSet = new Set<string>();
      kitchenItems.forEach((item) => {
        if (item.allergyWarnings && item.allergyWarnings.length > 0) {
          item.allergyWarnings.forEach((a) => allergiesSet.add(a));
        }
      });

      // Se o lugar do cliente tiver alergias no registo da comanda
      if (comanda.seats) {
        kitchenItems.forEach((item) => {
          if (item.seatNumber) {
            const seat = comanda.seats.find((s) => s.seatNumber === item.seatNumber);
            if (seat && seat.allergies.length > 0) {
              seat.allergies.forEach((a) => allergiesSet.add(`${a.name} (Lugar ${seat.seatNumber})`));
            }
          }
        });
      }

      // Determinar Estado Geral do Ticket
      const allReady = activeItems.length > 0 && activeItems.every((i) => i.status === 'pronto');
      const allDelivered = activeItems.length > 0 && activeItems.every((i) => i.status === 'entregue');
      const allReceived = activeItems.length > 0 && activeItems.every((i) => i.status === 'recebido');
      const hasPrepping = activeItems.some((i) => i.status === 'em_preparacao');
      const hasReady = activeItems.some((i) => i.status === 'pronto');
      const allCancelled = activeItems.length === 0 && cancelledItems.length > 0;

      let overallStatus: KitchenTicket['overallStatus'] = 'novos';
      if (allCancelled) {
        overallStatus = 'cancelados';
      } else if (allDelivered) {
        overallStatus = 'historico';
      } else if (allReady) {
        overallStatus = 'pronto';
      } else if (hasReady && (hasPrepping || allReceived)) {
        overallStatus = 'parcial';
      } else if (hasPrepping) {
        overallStatus = 'em_preparacao';
      } else {
        overallStatus = 'novos';
      }

      tickets.push({
        id: `${comanda.id}-r${round.roundNumber}`,
        isOnline: false,
        comandaId: comanda.id,
        comandaNumber: comanda.numberDisplay,
        tableName: comanda.tableName,
        roomName: comanda.roomName,
        roundNumber: round.roundNumber,
        roundCreatedAt: round.createdAt,
        waiterName: round.waiterName || comanda.waiterName,
        guestCount: comanda.guestCount,
        items: kitchenItems,
        allRoundItemsCount: round.items.length,
        kitchenAlertedAt: round.kitchenAlertedAt,
        kitchenAcknowledgedAt: round.kitchenAcknowledgedAt,
        kitchenAcknowledgedBy: round.kitchenAcknowledgedBy,
        allergies: Array.from(allergiesSet),
        cancelledItems,
        hasDeliveredAll: allDelivered,
        overallStatus,
      });
    }
  }

  // 2. Construir Tickets dos Pedidos Online do Site (Takeaway & Delivery)
  for (const order of onlineOrders) {
    const kitchenItems = order.items.filter((item) => {
      if (item.sector !== 'cozinha' && item.sector !== 'pastelaria') return false;
      if (subSectorFilter !== 'todos' && item.sector !== subSectorFilter) return false;
      return true;
    });

    if (kitchenItems.length === 0) continue;

    const allDelivered = order.prepStatus === 'entregue';
    const allReady = order.prepStatus === 'pronto';
    const isPrepping = order.prepStatus === 'em_preparacao';

    let overallStatus: KitchenTicket['overallStatus'] = 'novos';
    if (allDelivered) {
      overallStatus = 'historico';
    } else if (allReady) {
      overallStatus = 'pronto';
    } else if (isPrepping) {
      overallStatus = 'em_preparacao';
    } else {
      overallStatus = 'novos';
    }

    tickets.push({
      id: order.id,
      isOnline: true,
      comandaNumber: order.id,
      tableName: `Site: ${order.customerName}`,
      roomName: order.deliveryType === 'entrega' ? 'Entrega em Casa' : 'Takeaway / Recolha',
      roundNumber: 1,
      roundCreatedAt: order.createdAt,
      waiterName: 'Pedido Online',
      items: kitchenItems,
      allRoundItemsCount: order.items.length,
      allergies: [],
      cancelledItems: [],
      hasDeliveredAll: allDelivered,
      overallStatus,
    });
  }

  // Ordenar por hora de envio (os mais antigos primeiro para respeitar a fila)
  tickets.sort(
    (a, b) => new Date(a.roundCreatedAt).getTime() - new Date(b.roundCreatedAt).getTime()
  );

  // Alerta Sonoro de Novo Pedido
  const activeTicketsCount = tickets.filter((t) => t.overallStatus !== 'historico').length;
  useEffect(() => {
    if (prevActiveCountRef.current > 0 && activeTicketsCount > prevActiveCountRef.current && soundEnabled) {
      playAlertSound('order');
    }
    prevActiveCountRef.current = activeTicketsCount;
  }, [activeTicketsCount, soundEnabled]);

  // Filtragem Geral dos Tickets
  const filteredTickets = tickets.filter((t) => {
    // Filtro por Estado
    if (statusFilter === 'novos') {
      if (t.overallStatus !== 'novos') return false;
    } else if (statusFilter === 'em_preparacao') {
      if (t.overallStatus !== 'em_preparacao' && t.overallStatus !== 'parcial') return false;
    } else if (statusFilter === 'pronto') {
      if (t.overallStatus !== 'pronto') return false;
    } else if (statusFilter === 'historico') {
      if (t.overallStatus !== 'historico') return false;
    } else if (statusFilter === 'cancelados') {
      if (t.cancelledItems.length === 0) return false;
    } else if (statusFilter === 'todos') {
      // Exclui apenas os já entregues por padrão para não sobrecarregar o ecrã ativo
      if (t.overallStatus === 'historico') return false;
    }

    // Filtro por Origem
    if (originFilter === 'site' && !t.isOnline) return false;
    if (originFilter === 'sala' && (t.isOnline || !t.roomName.toLowerCase().includes('principal'))) return false;
    if (originFilter === 'esplanada' && (t.isOnline || !t.roomName.toLowerCase().includes('esplanada'))) return false;

    // Filtro de Pesquisa de Texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        t.tableName.toLowerCase().includes(q) ||
        t.comandaNumber.toLowerCase().includes(q) ||
        t.waiterName.toLowerCase().includes(q) ||
        t.items.some((i) => i.productName.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  // Ações de Estado
  const handleUpdateItemStatus = (itemId: string, nextStatus: ItemPrepStatus) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      store.updateItemPrepStatus(itemId, nextStatus, currentUser);
      if (nextStatus === 'pronto' && soundEnabled) {
        playAlertSound('ready');
      }
    } finally {
      setTimeout(() => setIsProcessing(false), 200);
    }
  };

  const handleStartAllItems = (ticket: KitchenTicket) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      ticket.items.forEach((it) => {
        if (it.status === 'recebido') {
          store.updateItemPrepStatus(it.id, 'em_preparacao', currentUser);
        }
      });
    } finally {
      setTimeout(() => setIsProcessing(false), 300);
    }
  };

  const handleMarkTicketAllReady = (ticket: KitchenTicket) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      if (ticket.isOnline) {
        store.markOnlineOrderSectorReady(ticket.id, 'cozinha', currentUser);
      } else if (ticket.comandaId) {
        store.markRoundSectorReady(ticket.comandaId, ticket.roundNumber, 'cozinha', currentUser);
      }

      setJustNotifiedTicketId(ticket.id);
      if (soundEnabled) {
        playAlertSound('ready');
      }
      setTimeout(() => {
        setJustNotifiedTicketId(null);
      }, 4000);
    } finally {
      setTimeout(() => setIsProcessing(false), 300);
    }
  };

  const handleAcknowledgeAlert = (ticket: KitchenTicket) => {
    if (ticket.comandaId) {
      store.acknowledgeKitchenAlert(ticket.comandaId, ticket.roundNumber, currentUser);
    }
  };

  const handleAcknowledgeAllergies = (ticketId: string) => {
    setAcknowledgedAllergies((prev) => ({ ...prev, [ticketId]: true }));
    store.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'ALERGIA_CONFIRMADA_COZINHA',
      module: 'cozinha',
      details: `Equipa da cozinha confirmou leitura e precaução de alergias no bilhete ${ticketId}`,
      targetId: ticketId,
    });
  };

  const handleAcknowledgeCancellation = (ticketId: string) => {
    setAcknowledgedCancellations((prev) => ({ ...prev, [ticketId]: true }));
  };

  // Contadores no Topo e Separadores
  const countNovos = tickets.filter((t) => t.overallStatus === 'novos').length;
  const countPrepping = tickets.filter((t) => t.overallStatus === 'em_preparacao' || t.overallStatus === 'parcial').length;
  const countProntos = tickets.filter((t) => t.overallStatus === 'pronto').length;
  const countCancelados = tickets.filter((t) => t.cancelledItems.length > 0).length;
  const countHistorico = tickets.filter((t) => t.overallStatus === 'historico').length;
  const countFilaAtiva = tickets.filter((t) => t.overallStatus !== 'historico').length;
  const countAtrasados = tickets.filter((t) => {
    const elapsed = getElapsedMinutes(t.roundCreatedAt);
    return elapsed >= (settings.expectedPrepTimeMinutes + settings.delayToleranceMinutes) && t.overallStatus !== 'historico';
  }).length;

  const hasActiveFilters =
    statusFilter !== 'todos' ||
    subSectorFilter !== 'todos' ||
    originFilter !== 'todas' ||
    searchQuery.trim() !== '';

  const handleClearFilters = () => {
    setStatusFilter('todos');
    setSubSectorFilter('todos');
    setOriginFilter('todas');
    setSearchQuery('');
  };

  // Produtos da cozinha para modal de indisponibilidade
  const kitchenProducts = products.filter((p) => p.sector === 'cozinha' || p.sector === 'pastelaria');

  // Validação de Permissões
  const hasAccess = store.canUserAccessModule(currentUser, 'cozinha');

  return (
    <div className={`space-y-3 animate-in fade-in duration-300 ${isFullscreen ? 'p-3 sm:p-4 bg-stone-950 min-h-screen' : ''}`}>
      {/* Aviso de Permissão caso o operador atual não seja da Cozinha ou Administração */}
      {!hasAccess && (
        <div className="bg-rose-950/80 border border-rose-600 p-3.5 rounded-2xl flex items-center justify-between text-xs text-rose-200 shadow-xl">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <strong className="text-white">Atenção:</strong> O utilizador atual (<strong>{currentUser.name}</strong>) tem perfil de <em>{currentUser.role}</em>. O acesso de gravação deve ser realizado pela equipa da Cozinha ou Administração.
            </div>
          </div>
          <button
            onClick={() => {
              const kitchenUser = state.users.find((u) => u.role === 'kitchen') || state.users[0];
              store.setCurrentUser(kitchenUser);
            }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md transition-all shrink-0"
          >
            Mudar para Chef Rui (Cozinha)
          </button>
        </div>
      )}

      {/* Barra de Controlo Unificada: Cozinha & Copa (2 Linhas Compactas) */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-2.5 sm:p-3 shadow-md space-y-2.5">
        {/* PRIMEIRA LINHA: Identidade, Tempo Real, Detalhes de Conexão e Ações */}
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          {/* Esquerda: Ícone Discreto + Título + Indicador Tempo Real + Menu de Informações */}
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
              <Flame className="w-4 h-4" />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight whitespace-nowrap">
                Cozinha & Copa
              </h1>

              <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono inline-flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Tempo Real</span>
              </span>

              {countAtrasados > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/80 inline-flex items-center gap-1 animate-pulse shrink-0">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span>{countAtrasados} atrasado{countAtrasados > 1 ? 's' : ''}</span>
                </span>
              )}

              {!state.isOnline && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80 inline-flex items-center gap-1 shrink-0">
                  <span>Offline</span>
                </span>
              )}

              {/* Menu de Informações do Operador e Conectividade */}
              <div className="relative" ref={infoRef}>
                <button
                  onClick={() => setInfoOpen(!infoOpen)}
                  className={`h-7 px-2 rounded-lg border transition-all text-xs flex items-center gap-1 ${
                    infoOpen
                      ? 'bg-stone-800 border-stone-700 text-stone-100'
                      : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                  title="Informações de operador e conectividade"
                  aria-label="Informações de operador e conectividade"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium hidden md:inline">Info</span>
                </button>

                {infoOpen && (
                  <div className="absolute left-0 mt-1.5 w-72 z-50 bg-stone-900 border border-stone-800 rounded-xl p-3 shadow-2xl text-xs space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                      <span className="font-bold text-white">Estado da Estação</span>
                      <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Operacional
                      </span>
                    </div>
                    <div className="space-y-1.5 text-stone-300 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-400">Operador:</span>
                        <strong className="text-white">{currentUser.name}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-400">Perfil:</span>
                        <span className="capitalize text-stone-300 font-medium">{currentUser.role}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-400">Ligação:</span>
                        <span className="text-emerald-400 font-medium">Atendimento, Bar, Caixa, Site</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-400">Tempo Padrão:</span>
                        <span className="text-stone-200 font-mono">{settings.expectedPrepTimeMinutes} min (+{settings.delayToleranceMinutes} tol.)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Direita: Ações Som, Esgotar prato, Ecrã completo */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* Botão Som */}
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              className={`h-8 px-2.5 rounded-xl border transition-all text-xs flex items-center gap-1.5 ${
                soundEnabled
                  ? 'bg-stone-950/80 border-stone-800 text-stone-300 hover:text-white hover:border-stone-700'
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-300 hover:bg-rose-950'
              }`}
              title={soundEnabled ? 'Silenciar alertas sonoros' : 'Ativar alertas sonoros'}
              aria-label={soundEnabled ? 'Silenciar alertas sonoros' : 'Ativar alertas sonoros'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-stone-300" /> : <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
              <span className="hidden md:inline font-medium text-[11px]">{soundEnabled ? 'Som' : 'Mudo'}</span>
            </button>

            {/* Botão Esgotar Prato */}
            <button
              onClick={() => setUnavailableModalOpen(true)}
              className="h-8 px-2.5 sm:px-3 bg-stone-950/80 hover:bg-stone-800 text-stone-200 text-xs font-medium rounded-xl border border-stone-800 hover:border-stone-700 transition-all flex items-center gap-1.5"
              title="Comunicar prato esgotado ou indisponível"
              aria-label="Comunicar prato esgotado ou indisponível"
            >
              <Ban className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-semibold text-[11px]">Esgotar Prato</span>
            </button>

            {/* Botão Ecrã Completo */}
            <button
              onClick={toggleFullscreen}
              className="h-8 w-8 rounded-xl bg-stone-950/80 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 hover:border-stone-700 transition-all flex items-center justify-center shrink-0"
              title={isFullscreen ? 'Sair do Modo Ecrã Inteiro' : 'Modo Ecrã Inteiro (Monitor de Cozinha)'}
              aria-label={isFullscreen ? 'Sair do Modo Ecrã Inteiro' : 'Modo Ecrã Inteiro (Monitor de Cozinha)'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* SEGUNDA LINHA: Separadores dos Pedidos com Contadores, Filtros e Pesquisa */}
        <div className="pt-2 border-t border-stone-800/80 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          {/* Separadores dos Pedidos com Contadores Reais */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {/* Fila ativa */}
            <button
              onClick={() => setStatusFilter('todos')}
              className={`h-8 px-2.5 sm:px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === 'todos'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800/50'
              }`}
            >
              <span>Fila ativa</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                statusFilter === 'todos' ? 'bg-orange-700 text-white' : 'bg-stone-800 text-stone-300'
              }`}>
                {countFilaAtiva}
              </span>
            </button>

            {/* Novos */}
            <button
              onClick={() => setStatusFilter('novos')}
              className={`h-8 px-2.5 sm:px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === 'novos'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800/50'
              }`}
            >
              <span>Novos</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                statusFilter === 'novos' ? 'bg-orange-700 text-white' : 'bg-stone-800 text-stone-300'
              }`}>
                {countNovos}
              </span>
            </button>

            {/* Em preparação (Substitui "No Fogo") */}
            <button
              onClick={() => setStatusFilter('em_preparacao')}
              className={`h-8 px-2.5 sm:px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === 'em_preparacao'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800/50'
              }`}
            >
              <span>Em preparação</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                statusFilter === 'em_preparacao' ? 'bg-orange-700 text-white' : 'bg-stone-800 text-stone-300'
              }`}>
                {countPrepping}
              </span>
            </button>

            {/* Prontos */}
            <button
              onClick={() => setStatusFilter('pronto')}
              className={`h-8 px-2.5 sm:px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === 'pronto'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800/50'
              }`}
            >
              <span>Prontos</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                statusFilter === 'pronto' ? 'bg-orange-700 text-white' : 'bg-stone-800 text-stone-300'
              }`}>
                {countProntos}
              </span>
            </button>

            {/* Cancelados */}
            <button
              onClick={() => setStatusFilter('cancelados')}
              className={`h-8 px-2.5 sm:px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === 'cancelados'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800/50'
              }`}
            >
              <span>Cancelados</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                statusFilter === 'cancelados' ? 'bg-orange-700 text-white' : 'bg-stone-800 text-stone-300'
              }`}>
                {countCancelados}
              </span>
            </button>

            {/* Histórico */}
            <button
              onClick={() => setStatusFilter('historico')}
              className={`h-8 px-2.5 sm:px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === 'historico'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white hover:bg-stone-800/50'
              }`}
            >
              <span>Histórico</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                statusFilter === 'historico' ? 'bg-orange-700 text-white' : 'bg-stone-800 text-stone-300'
              }`}>
                {countHistorico}
              </span>
            </button>
          </div>

          {/* Filtros de Setor, Origem, Pesquisa e Botão Limpar */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-1 justify-end min-w-0">
            {/* Botão Filtros para Mobile (< sm) */}
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`sm:hidden h-8 px-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 shrink-0 ${
                subSectorFilter !== 'todos' || originFilter !== 'todas'
                  ? 'bg-orange-600/20 border-orange-500/40 text-orange-300'
                  : 'bg-stone-950/80 border-stone-800 text-stone-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {(subSectorFilter !== 'todos' || originFilter !== 'todas') && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              )}
            </button>

            {/* Filtro de Setor & Origem (adaptável para mobile/desktop) */}
            <div className={`${showMobileFilters ? 'flex' : 'hidden'} sm:flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0`}>
              {/* Sub-Setor: Todos, Cozinha, Pastelaria */}
              <div className="flex items-center bg-stone-950/80 p-0.5 rounded-xl border border-stone-800 h-8 shrink-0">
                <button
                  onClick={() => setSubSectorFilter('todos')}
                  className={`h-7 px-2 sm:px-2.5 rounded-lg text-xs font-medium transition-all ${
                    subSectorFilter === 'todos' ? 'bg-stone-800 text-white font-bold' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setSubSectorFilter('cozinha')}
                  className={`h-7 px-2 sm:px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                    subSectorFilter === 'cozinha' ? 'bg-orange-600 text-white font-bold' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span>Cozinha</span>
                </button>
                <button
                  onClick={() => setSubSectorFilter('pastelaria')}
                  className={`h-7 px-2 sm:px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                    subSectorFilter === 'pastelaria' ? 'bg-orange-600 text-white font-bold' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <Cake className="w-3 h-3 text-amber-400" />
                  <span>Pastelaria</span>
                </button>
              </div>

              {/* Origem */}
              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value as KitchenOriginFilter)}
                className="h-8 bg-stone-950/80 border border-stone-800 rounded-xl px-2.5 text-xs text-stone-200 focus:outline-none focus:border-orange-500 shrink-0"
              >
                <option value="todas">Todas as Origens</option>
                <option value="sala">Sala Principal</option>
                <option value="esplanada">Esplanada</option>
                <option value="site">Pedidos do Site (Online)</option>
              </select>
            </div>

            {/* Campo de Pesquisa com Largura Flexível */}
            <div className="relative flex-1 min-w-[130px] max-w-full sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar mesa, prato..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-7 bg-stone-950/80 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-orange-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Opção Limpar Filtros (apenas quando houver filtros aplicados) */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="h-8 px-2.5 bg-stone-800 hover:bg-stone-700 text-amber-300 hover:text-amber-200 text-xs font-semibold rounded-xl border border-stone-700 transition-all flex items-center gap-1 shrink-0"
                title="Limpar filtros aplicados"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Limpar filtros</span>
                <span className="sm:hidden">Limpar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grelha de Bilhetes KDS */}
      {filteredTickets.length === 0 ? (
        <div className="bg-stone-900/60 border border-dashed border-stone-800 rounded-3xl p-16 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white">Sem pedidos pendentes neste filtro!</h3>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            {statusFilter === 'historico'
              ? 'Não existem pedidos no histórico deste setor.'
              : 'Todos os pratos e sobremesas enviados pelos empregados foram confecionados.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4 items-start">
          {filteredTickets.map((ticket) => {
            const elapsed = getElapsedMinutes(ticket.roundCreatedAt);
            const expectedMax = settings.expectedPrepTimeMinutes + settings.delayToleranceMinutes;
            const isLate = elapsed >= expectedMax;
            const isWarning = elapsed >= settings.expectedPrepTimeMinutes && !isLate;
            const isJustNotified = justNotifiedTicketId === ticket.id;

            const hasAllergies = ticket.allergies.length > 0;
            const isAllergyAcknowledged = acknowledgedAllergies[ticket.id];
            const hasCancellations = ticket.cancelledItems.length > 0;
            const isCancellationAcknowledged = acknowledgedCancellations[ticket.id];

            const activeItems = ticket.items.filter((i) => i.status !== 'cancelado');
            const readyItems = activeItems.filter((i) => i.status === 'pronto');
            const isPartiallyReady = readyItems.length > 0 && readyItems.length < activeItems.length;
            const isAllReady = activeItems.length > 0 && activeItems.every((i) => i.status === 'pronto');

            return (
              <div
                key={ticket.id}
                className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-md bg-stone-900 ${
                  isLate
                    ? 'border-rose-600 ring-2 ring-rose-500/40 shadow-rose-950/40'
                    : hasAllergies && !isAllergyAcknowledged
                    ? 'border-rose-500 shadow-rose-950/20 ring-1 ring-rose-500/50'
                    : isWarning
                    ? 'border-amber-600/80 shadow-amber-950/20 ring-1 ring-amber-500/20'
                    : isAllReady
                    ? 'border-emerald-600/60'
                    : isPartiallyReady
                    ? 'border-amber-500/60'
                    : 'border-stone-800'
                }`}
              >
                {/* Header do Bilhete KDS */}
                <div
                  className={`px-3 sm:px-3.5 py-2 sm:py-2.5 border-b flex items-start justify-between gap-2 ${
                    isLate
                      ? 'bg-rose-950/80 border-rose-800 text-rose-200'
                      : isWarning
                      ? 'bg-amber-950/60 border-amber-800 text-amber-200'
                      : isAllReady
                      ? 'bg-emerald-950/40 border-emerald-900/40 text-emerald-200'
                      : 'bg-stone-950/80 border-stone-800 text-stone-200'
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ticket.isOnline && <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                      <span className="font-bold text-sm sm:text-base text-white truncate">
                        {ticket.tableName}
                      </span>
                      <span className="text-[10px] sm:text-[11px] px-2 py-0.5 font-mono bg-stone-800 text-stone-200 rounded font-semibold">
                        {ticket.comandaNumber}
                      </span>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-stone-400 mt-1 flex items-center gap-1.5 flex-wrap leading-tight">
                      <span className="font-bold text-amber-400">R#{ticket.roundNumber}</span>
                      <span>• {ticket.roomName}</span>
                      <span>• <strong className="text-stone-300">{ticket.waiterName}</strong></span>
                    </div>
                  </div>

                  {/* Cronómetro e Hora */}
                  <div className="text-right shrink-0">
                    <div
                      className={`text-[11px] sm:text-xs font-mono font-bold flex items-center justify-end gap-1.5 px-2 py-1 rounded shadow-sm ${
                        isLate
                          ? 'bg-rose-600 text-white animate-pulse'
                          : isWarning
                          ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                          : 'bg-stone-800 text-stone-300'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {formatElapsed(ticket.roundCreatedAt)}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-stone-400 font-mono mt-0.5">
                      {formatTime(ticket.roundCreatedAt)}
                    </div>
                  </div>
                </div>

                {/* Banner de Alerta de Atraso e Confirmação da Cozinha */}
                {isLate && (
                  <div className="bg-rose-950/90 px-3 sm:px-3.5 py-2 border-b border-rose-800 text-xs text-rose-200 space-y-1">
                    <div className="font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-bounce" />
                        Excedeu limite (+{elapsed - settings.expectedPrepTimeMinutes} min)!
                      </span>
                    </div>

                    {ticket.kitchenAlertedAt && !ticket.kitchenAcknowledgedAt && (
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                          <Bell className="w-3 h-3 text-amber-400" />
                          {formatTime(ticket.kitchenAlertedAt)}
                        </span>
                        <button
                          onClick={() => handleAcknowledgeAlert(ticket)}
                          className="px-2 py-0.5 bg-rose-700 hover:bg-rose-600 text-white text-[10px] font-bold rounded shadow transition-all active:scale-95"
                        >
                          Confirmar
                        </button>
                      </div>
                    )}

                    {ticket.kitchenAcknowledgedAt && (
                      <div className="text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Visto às {formatTime(ticket.kitchenAcknowledgedAt)}
                      </div>
                    )}
                  </div>
                )}

                {/* Banner de Destaque Obrigatório de Alergias */}
                {hasAllergies && (
                  <div
                    className={`px-3 sm:px-3.5 py-1.5 border-b text-xs transition-all ${
                      isAllergyAcknowledged
                        ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                        : 'bg-rose-950 border-rose-700 text-rose-100 animate-pulse'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-start gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-white block font-bold text-[10px] sm:text-[11px]">ALERGIAS:</strong>
                          <span className="text-[10px] sm:text-[11px] leading-tight">{ticket.allergies.join(' • ')}</span>
                        </div>
                      </div>
                      {!isAllergyAcknowledged && (
                        <button
                          onClick={() => handleAcknowledgeAllergies(ticket.id)}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded shrink-0 shadow"
                        >
                          Confirmar
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Banner de Cancelamentos Notificados */}
                {hasCancellations && !isCancellationAcknowledged && (
                  <div className="bg-rose-950/70 border-b border-rose-800 px-3 sm:px-3.5 py-1.5 text-xs text-rose-200 flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      {ticket.cancelledItems.length} cancelado(s)
                    </span>
                    <button
                      onClick={() => handleAcknowledgeCancellation(ticket.id)}
                      className="px-2 py-0.5 bg-rose-800 hover:bg-rose-700 text-white text-[10px] font-bold rounded"
                    >
                      Ciente
                    </button>
                  </div>
                )}

                {/* Indicador de Pedido Parcialmente Pronto */}
                {isPartiallyReady && (
                  <div className="bg-amber-500/10 border-b border-amber-500/30 px-3 sm:px-3.5 py-1 text-[10px] font-bold text-amber-400 flex items-center justify-between">
                    <span>🟡 Parcial</span>
                    <span>{readyItems.length}/{activeItems.length} prontos</span>
                  </div>
                )}

                {/* Lista de Itens do Bilhete */}
                <div className="p-2 sm:p-2.5 space-y-1.5 flex-1 bg-stone-950/50">
                  {ticket.items.map((item) => {
                    const isCancelled = item.status === 'cancelado';
                    const isReady = item.status === 'pronto';
                    const isPrepping = item.status === 'em_preparacao';
                    const isReceived = item.status === 'recebido';
                    const isDelivered = item.status === 'entregue';

                    return (
                      <div
                        key={item.id}
                        className={`p-2 sm:p-2.5 rounded-xl border text-xs sm:text-sm transition-all ${
                          isCancelled
                            ? 'bg-rose-950/20 border-rose-900/60 opacity-60 line-through'
                            : isReady
                            ? 'bg-emerald-950/30 border-emerald-700/60 text-emerald-200'
                            : isPrepping
                            ? 'bg-amber-950/30 border-amber-700/50 text-amber-200'
                            : 'bg-stone-900 border-stone-800 text-stone-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex-1 min-w-0">
                            {/* Quantidade e Nome em destaque KDS */}
                            <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-2 leading-snug">
                              <span className="text-orange-400 text-sm sm:text-base font-mono font-extrabold shrink-0">{item.quantity}x</span>
                              <span className="break-words">{item.productName}</span>
                            </div>

                            {/* Lugar do Cliente */}
                            {item.seatName && item.seatName !== 'Para partilhar' && (
                              <div className="text-[10px] sm:text-[11px] font-bold text-amber-400 mt-1">
                                Para: {item.seatName}
                              </div>
                            )}

                            {/* Opções e Variantes */}
                            {item.selectedVariant && (
                              <div className="text-[10px] sm:text-[11px] text-stone-300 font-medium mt-0.5">
                                • Opção: {item.selectedVariant.name}
                              </div>
                            )}

                            {/* Adicionais / Extras */}
                            {item.selectedExtras.length > 0 && (
                              <div className="text-[10px] sm:text-[11px] text-stone-300 font-medium mt-0.5">
                                • Extras: {item.selectedExtras.map((e) => e.name).join(', ')}
                              </div>
                            )}

                            {/* Observações da Cozinha */}
                            {item.notes && (
                              <div className="text-[10px] sm:text-[11px] text-amber-300 font-semibold bg-amber-950/70 px-2 py-1 rounded-md mt-1 border border-amber-700/60">
                                ⚠ Obs: {item.notes}
                              </div>
                            )}

                            {/* Motivo do Cancelamento se houver */}
                            {isCancelled && item.cancelReason && (
                              <div className="text-[9px] text-rose-400 mt-0.5 font-mono">
                                Cancelado: {item.cancelReason} ({item.cancelledBy})
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Botões de Ação por Item */}
                        {!isCancelled && !isDelivered && (
                          <div className="flex items-center justify-between gap-1.5 mt-1.5 pt-1.5 border-t border-stone-800/80">
                            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-stone-400 font-mono">
                              {item.status === 'em_preparacao' ? 'Em Preparação' : item.status}
                            </span>

                            <div className="flex gap-1.5">
                              {isReceived && (
                                <button
                                  onClick={() => handleUpdateItemStatus(item.id, 'em_preparacao')}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold rounded-lg shadow flex items-center gap-1 transition-all"
                                >
                                  <Play className="w-2.5 h-2.5" />
                                  Iniciar
                                </button>
                              )}

                              {(isReceived || isPrepping) && (
                                <button
                                  onClick={() => handleUpdateItemStatus(item.id, 'pronto')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow transition-all"
                                >
                                  <Check className="w-3 h-3" />
                                  Pronto
                                </button>
                              )}

                              {isReady && (
                                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Pronto
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Rodapé do Ticket com Ações em Massa */}
                <div className="px-3 sm:px-3.5 py-2 sm:py-2.5 bg-stone-950 border-t border-stone-800 flex justify-between items-center gap-2">
                  <div className="text-[10px] sm:text-[11px] text-stone-400 font-mono">
                    Total: {activeItems.length} {activeItems.length === 1 ? 'prato' : 'pratos'}
                  </div>

                  {!isAllReady && !ticket.hasDeliveredAll ? (
                    <div className="flex items-center gap-1.5">
                      {activeItems.some((i) => i.status === 'recebido') && (
                        <button
                          onClick={() => handleStartAllItems(ticket)}
                          className="px-2.5 py-1.5 bg-amber-700 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          Iniciar Todos
                        </button>
                      )}
                      <button
                        onClick={() => handleMarkTicketAllReady(ticket)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Tudo Pronto
                      </button>
                    </div>
                  ) : ticket.hasDeliveredAll ? (
                    <span className="text-[11px] font-bold text-stone-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Entregue
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isJustNotified ? 'Notificado!' : 'Aguardando Garçom'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Comunicação de Indisponibilidade de Prato (Esgotamento) */}
      {unavailableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-stone-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-sm sm:text-base">Comunicar Indisponibilidade na Cozinha</h3>
              </div>
              <button
                onClick={() => setUnavailableModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-stone-400">
                Alterne a disponibilidade de pratos no cardápio caso algum ingrediente tenha esgotado na cozinha. Isso desativa imediatamente o item no Atendimento e no Site, evitando novos pedidos sem afetar pedidos em preparação.
              </p>

              <div className="space-y-2">
                {kitchenProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-stone-950 border border-stone-800 rounded-2xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-stone-200 text-sm">{p.name}</div>
                      <div className="text-[11px] text-stone-400">
                        {p.code} • Setor: <span className="uppercase font-mono">{p.sector}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        store.toggleProductAvailability(p.id);
                        store.addAuditLog({
                          userId: currentUser.id,
                          userName: currentUser.name,
                          userRole: currentUser.role,
                          action: p.available ? 'PRODUTO_INDISPONIVEL' : 'PRODUTO_DISPONIVEL',
                          module: 'cozinha',
                          details: `Cozinha alterou disponibilidade de "${p.name}" para ${p.available ? 'INDISPONÍVEL' : 'DISPONÍVEL'}`,
                          targetId: p.id,
                        });
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                        p.available
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 hover:bg-rose-900/50 hover:text-rose-200 hover:border-rose-600'
                          : 'bg-rose-950 text-rose-300 border border-rose-700/60 hover:bg-emerald-900/50 hover:text-emerald-200 hover:border-emerald-600'
                      }`}
                    >
                      {p.available ? 'Disponível (Esgotar)' : 'Esgotado (Ativar)'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-stone-800 bg-stone-950 flex justify-end">
              <button
                onClick={() => setUnavailableModalOpen(false)}
                className="px-5 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
