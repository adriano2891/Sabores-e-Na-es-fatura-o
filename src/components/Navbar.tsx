import React, { useState, useEffect, useRef } from 'react';
import {
  UtensilsCrossed,
  Flame,
  Wine,
  FileCheck2,
  ShieldCheck,
  Home,
  CheckCircle2,
  ChevronDown,
  ArrowRightLeft,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Smartphone,
  PlayCircle,
  Download,
  X,
  SlidersHorizontal,
  RefreshCw,
  Copy,
  Check,
  Shield,
  FilePlus,
  Clock,
} from 'lucide-react';
import { User, Table, Comanda, Product, ModuleType } from '../types';
import { store } from '../services/storage';
import { usePWAInstall } from './PWAInstallButton';

interface NavbarProps {
  currentModule: ModuleType | 'portal';
  onSelectModule: (module: ModuleType | 'portal', subTab?: string) => void;
  currentUser: User;
  shiftLeaderName?: string;
  onOpenOperatorModal: () => void;
  onOpenScenarioModal: () => void;
  onOpenShiftHandoverModal?: () => void;
  onOpenAdHocInvoice?: () => void;
  onExportInvoicingCsv?: () => void;
  tables: Table[];
  comandas: Comanda[];
  products: Product[];
  isOnline: boolean;
  soundEnabled: boolean;
  pendingSyncCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentModule,
  onSelectModule,
  currentUser,
  shiftLeaderName = 'Ana Costa',
  onOpenOperatorModal,
  onOpenScenarioModal,
  onOpenShiftHandoverModal,
  onOpenAdHocInvoice,
  onExportInvoicingCsv,
  tables,
  comandas,
  isOnline,
  soundEnabled,
  pendingSyncCount = 0,
}) => {
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPWAGuide, setShowPWAGuide] = useState(false);

  const moduleDropdownRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Fecha menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(target)) {
        setModuleDropdownOpen(false);
      }
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(target)) {
        setActionsMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Contadores para badges em tempo real
  const activeComandas = comandas.filter((c) => c.status === 'aberta' || c.status === 'conta_solicitada');

  // Prontos a entregar no atendimento
  const readyItemsCount = comandas.reduce((acc, c) => {
    return (
      acc +
      c.rounds.reduce((rAcc, r) => {
        return rAcc + r.items.filter((i) => i.status === 'pronto').length;
      }, 0)
    );
  }, 0);

  // Cozinha pendente
  const kitchenPending = comandas.reduce((acc, c) => {
    return (
      acc +
      c.rounds.reduce((rAcc, r) => {
        return (
          rAcc +
          r.items.filter(
            (i) => (i.sector === 'cozinha' || i.sector === 'pastelaria') && (i.status === 'recebido' || i.status === 'em_preparacao')
          ).length
        );
      }, 0)
    );
  }, 0);

  // Bar pendente
  const barPending = comandas.reduce((acc, c) => {
    return (
      acc +
      c.rounds.reduce((rAcc, r) => {
        return rAcc + r.items.filter((i) => i.sector === 'bar' && (i.status === 'recebido' || i.status === 'em_preparacao')).length;
      }, 0)
    );
  }, 0);

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente Operacional',
    waiter: 'Empregado de Mesa',
    kitchen: 'Cozinha / Copa',
    bar: 'Equipa do Bar',
    cashier: 'Operador de Caixa',
  };

  const moduleMeta: Record<ModuleType | 'portal', { label: string; icon: any; color: string; badge?: string | number }> = {
    portal: { label: 'Portal Geral de Acesso', icon: Home, color: 'text-amber-400' },
    atendimento: {
      label: 'Atendimento',
      icon: UtensilsCrossed,
      color: 'text-amber-400',
      badge: readyItemsCount > 0 ? `${readyItemsCount} pronto` : undefined,
    },
    cozinha: {
      label: 'Cozinha / Copa',
      icon: Flame,
      color: 'text-orange-400',
      badge: kitchenPending > 0 ? `${kitchenPending}` : undefined,
    },
    bar: {
      label: 'Bar',
      icon: Wine,
      color: 'text-cyan-400',
      badge: barPending > 0 ? `${barPending}` : undefined,
    },
    admin: {
      label: 'Administração',
      icon: ShieldCheck,
      color: 'text-purple-400',
      badge: activeComandas.filter((c) => c.status === 'conta_solicitada').length > 0 ? 'Conta!' : undefined,
    },
    faturacao: {
      label: 'Faturação & Notas',
      icon: FileCheck2,
      color: 'text-emerald-400',
    },
  };

  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager';

  const handleSelectModuleSafe = (mod: ModuleType | 'portal') => {
    setModuleDropdownOpen(false);
    if (mod === 'portal') {
      onSelectModule('portal');
      return;
    }
    if (store.canUserAccessModule(currentUser, mod)) {
      onSelectModule(mod);
    } else {
      alert(`Acesso restrito: A sua conta (${currentUser.name} - ${roleLabels[currentUser.role]}) não possui permissão para aceder ao módulo "${moduleMeta[mod].label}".`);
    }
  };

  const handleCopyWaiterLink = () => {
    const url = `${window.location.origin}/?modulo=atendimento`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleInstallClick = () => {
    setActionsMenuOpen(false);
    if (isInstallable) {
      install();
    } else {
      setShowPWAGuide(true);
    }
  };

  const handleToggleSound = () => {
    store.saveSettings({
      ...store.getState().settings,
      soundAlertsEnabled: !soundEnabled,
    });
  };

  const CurrentModuleIcon = moduleMeta[currentModule].icon;

  return (
    <header className="bg-stone-950 border-b border-stone-800/80 text-stone-200 select-none sticky top-0 z-40">
      {/* Barra de Navegação Única, Compacta e Alinhada */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 md:px-5 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
        {/* À ESQUERDA: Logótipo Sabores & Nações (Acesso ao Portal Geral) + Seletor de "Administração" */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Logótipo Oficial e Acesso ao Portal Geral */}
          <button
            onClick={() => onSelectModule('portal')}
            className={`flex items-center gap-2 group focus:outline-none p-1 rounded-xl transition-all ${
              currentModule === 'portal' ? 'ring-2 ring-amber-500/50' : ''
            }`}
            title="Sabores & Nações - Ir para o Portal Geral"
          >
            <div className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-600 via-orange-600 to-rose-700 flex items-center justify-center shadow-md text-white font-black text-sm sm:text-base border border-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
              S&N
            </div>
            <span className="font-extrabold tracking-tight text-white text-sm sm:text-base hidden sm:inline shrink-0">
              Sabores & Nações
            </span>
          </button>

          {/* Separador vertical discreto */}
          <div className="h-5 w-px bg-stone-800 hidden xs:block shrink-0" />

          {/* Seletor "Administração" com acesso a módulos */}
          <div className="relative shrink-0" ref={moduleDropdownRef}>
            <div
              className={`flex items-center h-9 rounded-xl border transition-all shadow-sm ${
                currentModule === 'admin'
                  ? 'bg-purple-950/40 text-purple-200 border-purple-800/70 ring-1 ring-purple-500/30'
                  : 'bg-stone-900/60 hover:bg-stone-900 border-stone-800/80 hover:border-stone-700 text-stone-300 hover:text-white'
              }`}
            >
              <button
                onClick={() => handleSelectModuleSafe('admin')}
                className="h-full px-2.5 sm:px-3 flex items-center gap-1.5 text-xs sm:text-sm font-bold transition-colors focus:outline-none"
                title="Módulo Administração (Clique para abrir)"
              >
                <ShieldCheck
                  className={`w-4 h-4 shrink-0 ${
                    currentModule === 'admin' ? 'text-purple-400' : 'text-purple-400/80'
                  }`}
                />
                <span className="tracking-tight">Administração</span>
              </button>
              <button
                onClick={() => setModuleDropdownOpen(!moduleDropdownOpen)}
                className="h-full px-2 border-l border-stone-800/60 text-stone-400 hover:text-white hover:bg-stone-850 rounded-r-xl transition-colors focus:outline-none"
                title="Abrir menu de módulos do sistema"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    moduleDropdownOpen ? 'rotate-180 text-amber-400' : ''
                  }`}
                />
              </button>
            </div>

            {/* Menu Dropdown de Módulos */}
            {moduleDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-64 sm:w-72 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in py-1">
                <div className="px-3 py-2 border-b border-stone-800 text-[10px] uppercase font-bold text-stone-400 flex items-center justify-between">
                  <span>Módulos do Sistema</span>
                  {isAdminOrManager && <span className="text-purple-400 font-mono text-[9px]">Acesso Total</span>}
                </div>

                {/* Em Tablet e Telemóvel: Atalhos Rápidos Integrados no Seletor */}
                <div className="md:hidden px-2.5 py-2 border-b border-stone-800 bg-stone-950/70">
                  <div className="text-[10px] uppercase font-bold text-stone-400 mb-1.5 flex items-center justify-between">
                    <span>Atalhos Rápidos</span>
                    <span className="text-[9px] text-amber-400 font-mono">1 Clique</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handleSelectModuleSafe('atendimento')}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-semibold transition-all ${
                        currentModule === 'atendimento'
                          ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 shadow'
                          : 'bg-stone-900 border-stone-800 text-stone-300 hover:text-white hover:border-stone-700'
                      }`}
                    >
                      <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                      <span>Atendimento</span>
                    </button>

                    <button
                      onClick={() => handleSelectModuleSafe('cozinha')}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-semibold transition-all ${
                        currentModule === 'cozinha'
                          ? 'bg-orange-500/20 text-orange-200 border-orange-500/40 shadow'
                          : 'bg-stone-900 border-stone-800 text-stone-300 hover:text-white hover:border-stone-700'
                      }`}
                    >
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span>Cozinha</span>
                    </button>

                    <button
                      onClick={() => handleSelectModuleSafe('bar')}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-semibold transition-all ${
                        currentModule === 'bar'
                          ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40 shadow'
                          : 'bg-stone-900 border-stone-800 text-stone-300 hover:text-white hover:border-stone-700'
                      }`}
                    >
                      <Wine className="w-4 h-4 text-cyan-400" />
                      <span>Bar</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectModuleSafe('portal')}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                    currentModule === 'portal'
                      ? 'bg-amber-600/20 text-amber-300 font-bold'
                      : 'text-stone-300 hover:bg-stone-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-amber-400" />
                    <span>Portal Geral de Acesso</span>
                  </div>
                  {currentModule === 'portal' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                </button>

                {(['admin', 'atendimento', 'cozinha', 'bar', 'faturacao'] as ModuleType[]).map((m) => {
                  const mData = moduleMeta[m];
                  const MIcon = mData.icon;
                  const isAuth = store.canUserAccessModule(currentUser, m);
                  const isCurrent = currentModule === m;

                  return (
                    <button
                      key={m}
                      onClick={() => handleSelectModuleSafe(m)}
                      disabled={!isAuth}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                        isCurrent
                          ? 'bg-purple-600/20 text-purple-300 font-bold'
                          : isAuth
                          ? 'text-stone-200 hover:bg-stone-800/80'
                          : 'text-stone-600 bg-stone-950/40 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MIcon className={`w-4 h-4 ${mData.color}`} />
                        <span>{mData.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {mData.badge && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-300 font-bold font-mono">
                            {mData.badge}
                          </span>
                        )}
                        {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* NA ÁREA CENTRAL (Computador): Atalhos Compactos em Linha Única para Atendimento, Cozinha/Copa e Bar */}
        <div className="hidden md:flex items-center justify-center shrink-0">
          <nav className="flex items-center gap-1 p-0.5 sm:p-1 bg-stone-900/70 border border-stone-800/80 rounded-xl shadow-inner">
            {/* Atalho Atendimento */}
            <button
              onClick={() => handleSelectModuleSafe('atendimento')}
              className={`h-8 px-2.5 lg:px-3 rounded-lg flex items-center gap-1.5 text-xs transition-all ${
                currentModule === 'atendimento'
                  ? 'bg-amber-500/20 text-amber-200 font-bold border border-amber-500/40 shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80 border border-transparent font-medium'
              }`}
              title="Mudar para Atendimento (Comandas & Mesas)"
            >
              <UtensilsCrossed
                className={`w-3.5 h-3.5 shrink-0 ${
                  currentModule === 'atendimento' ? 'text-amber-400' : 'text-amber-400/80'
                }`}
              />
              <span>Atendimento</span>
              {readyItemsCount > 0 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {readyItemsCount}
                </span>
              )}
            </button>

            {/* Atalho Cozinha / Copa */}
            <button
              onClick={() => handleSelectModuleSafe('cozinha')}
              className={`h-8 px-2.5 lg:px-3 rounded-lg flex items-center gap-1.5 text-xs transition-all ${
                currentModule === 'cozinha'
                  ? 'bg-orange-500/20 text-orange-200 font-bold border border-orange-500/40 shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80 border border-transparent font-medium'
              }`}
              title="Mudar para Cozinha & Copa (KDS)"
            >
              <Flame
                className={`w-3.5 h-3.5 shrink-0 ${
                  currentModule === 'cozinha' ? 'text-orange-400' : 'text-orange-400/80'
                }`}
              />
              <span className="hidden lg:inline">Cozinha / Copa</span>
              <span className="lg:hidden">Cozinha</span>
              {kitchenPending > 0 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-stone-800 text-orange-300">
                  {kitchenPending}
                </span>
              )}
            </button>

            {/* Atalho Bar */}
            <button
              onClick={() => handleSelectModuleSafe('bar')}
              className={`h-8 px-2.5 lg:px-3 rounded-lg flex items-center gap-1.5 text-xs transition-all ${
                currentModule === 'bar'
                  ? 'bg-cyan-500/20 text-cyan-200 font-bold border border-cyan-500/40 shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800/80 border border-transparent font-medium'
              }`}
              title="Mudar para Bar (BDS)"
            >
              <Wine
                className={`w-3.5 h-3.5 shrink-0 ${
                  currentModule === 'bar' ? 'text-cyan-400' : 'text-cyan-400/80'
                }`}
              />
              <span>Bar</span>
              {barPending > 0 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-stone-800 text-cyan-300">
                  {barPending}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* À DIREITA: Sincronização, Menu Ações e Perfil do Utilizador */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Botão Criar Fatura Avulsa (se estiver no módulo de faturação) */}
          {currentModule === 'faturacao' && onOpenAdHocInvoice && (
            <button
              onClick={onOpenAdHocInvoice}
              className="h-9 px-2.5 sm:px-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-950/30 flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
              title="Criar nova fatura avulsa com NIF e itens personalizados"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Criar Fatura</span>
            </button>
          )}

          {/* Informação do Turno Ativo (Texto Secundário Discreto) */}
          {shiftLeaderName && (
            <div
              className="hidden lg:flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-stone-800/80 bg-stone-900/60 text-xs text-stone-400 shrink-0"
              title={`Responsável pelo turno ativo: ${shiftLeaderName} (Distinto da conta autenticada: ${currentUser.name})`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
              <span className="text-stone-400 text-[11px]">Turno:</span>
              <strong className="text-stone-200 font-semibold text-xs tracking-tight">{shiftLeaderName}</strong>
            </div>
          )}

          {/* Indicador de Sincronização */}
          <button
            onClick={() => store.setOnline(!isOnline)}
            className={`h-9 px-2.5 sm:px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all shadow-sm ${
              !isOnline
                ? 'bg-rose-950/70 text-rose-300 border-rose-700/80 hover:bg-rose-900/60 animate-pulse'
                : pendingSyncCount > 0
                ? 'bg-amber-950/50 text-amber-300 border-amber-700/60 hover:bg-amber-900/50'
                : 'bg-stone-900/60 text-emerald-400 border-stone-800/80 hover:bg-stone-900'
            }`}
            title={
              !isOnline
                ? 'Modo Offline: novos dados em cache local (Clique para reconectar)'
                : pendingSyncCount > 0
                ? `${pendingSyncCount} operação(ões) pendente(s) de envio para a nuvem`
                : 'Sistema online e dados sincronizados em tempo real (Clique para simular offline)'
            }
          >
            {!isOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-bold hidden xs:inline">Offline</span>
              </>
            ) : pendingSyncCount > 0 ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="font-medium hidden sm:inline">{pendingSyncCount} pendente(s)</span>
                <span className="font-medium sm:hidden">{pendingSyncCount}</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Wifi className="w-3.5 h-3.5 text-emerald-400 hidden xs:inline" />
                <span className="hidden md:inline font-medium text-emerald-300">Sincronizado</span>
                <span className="hidden xs:inline md:hidden font-medium text-emerald-300">Online</span>
              </>
            )}
          </button>

          {/* Menu de Ações (Passar Turno, Link Garçom, Instalar App, Som e Cenário de Teste) */}
          <div className="relative" ref={actionsMenuRef}>
            <button
              onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
              className={`h-9 px-2 sm:px-2.5 md:px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all shadow-sm ${
                actionsMenuOpen
                  ? 'bg-stone-800 text-white border-stone-600'
                  : 'bg-stone-900/60 hover:bg-stone-900 text-stone-300 hover:text-white border-stone-800/80 hover:border-stone-700'
              }`}
              title="Menu de ações e ferramentas"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Ações</span>
              <ChevronDown
                className={`w-3 h-3 text-stone-400 transition-transform duration-200 shrink-0 ${
                  actionsMenuOpen ? 'rotate-180 text-amber-400' : ''
                }`}
              />
            </button>

            {/* Dropdown do Menu de Ações */}
            {actionsMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-72 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in py-1.5">
                <div className="px-3 py-1.5 border-b border-stone-800/80 text-[10px] uppercase font-bold text-stone-400">
                  Ações & Atalhos
                </div>

                <div className="py-1 space-y-0.5">
                  {/* Exportar CSV (Disponível no módulo de faturação) */}
                  {onExportInvoicingCsv && (
                    <button
                      onClick={() => {
                        setActionsMenuOpen(false);
                        onExportInvoicingCsv();
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs text-stone-200 hover:bg-stone-800/80 transition-colors"
                    >
                      <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">Exportar CSV</div>
                        <div className="text-[10px] text-stone-400">Exportar documentos fiscais emitidos</div>
                      </div>
                    </button>
                  )}

                  {/* Passagem de Turno */}
                  {onOpenShiftHandoverModal && (
                    <button
                      onClick={() => {
                        setActionsMenuOpen(false);
                        onOpenShiftHandoverModal();
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs text-stone-200 hover:bg-stone-800/80 transition-colors"
                    >
                      <ArrowRightLeft className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">Passar Turno</div>
                        <div className="text-[10px] text-stone-400">Conferir e transferir caixa ou serviço</div>
                      </div>
                    </button>
                  )}

                  {/* Copiar Link Garçom */}
                  <button
                    onClick={handleCopyWaiterLink}
                    className="w-full px-3 py-2 text-left flex items-center justify-between text-xs text-stone-200 hover:bg-stone-800/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">Link Garçom</div>
                        <div className="text-[10px] text-stone-400">Acesso direto ao ecrã de atendimento</div>
                      </div>
                    </div>
                    {copiedLink ? (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                        <Check className="w-3 h-3" /> Copiado!
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-stone-500" />
                    )}
                  </button>

                  {/* Instalar App (PWA) */}
                  <button
                    onClick={handleInstallClick}
                    className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs text-stone-200 hover:bg-stone-800/80 transition-colors"
                  >
                    <Download className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">
                        {isInstalled ? 'App Instalada' : 'Instalar Aplicação'}
                      </div>
                      <div className="text-[10px] text-stone-400">
                        {isInstalled ? 'Sistema ativo em ecrã inteiro' : 'Adicionar ao ecrã inicial do telemóvel'}
                      </div>
                    </div>
                  </button>

                  {/* Controlo de Som */}
                  <button
                    onClick={handleToggleSound}
                    className="w-full px-3 py-2 text-left flex items-center justify-between text-xs text-stone-200 hover:bg-stone-800/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-stone-500 shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-white">Alertas Sonoros</div>
                        <div className="text-[10px] text-stone-400">Avisos de novos pedidos e chamados</div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                        soundEnabled
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {soundEnabled ? 'Ativo' : 'Mudo'}
                    </span>
                  </button>
                </div>

                {/* Cenário de Teste (Apenas para utilizadores autorizados da administração) */}
                {isAdminOrManager && (
                  <div className="border-t border-stone-800 pt-1 mt-1">
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-purple-400 flex items-center justify-between">
                      <span>Ferramentas de Administração</span>
                      <Shield className="w-3 h-3" />
                    </div>

                    <button
                      onClick={() => {
                        setActionsMenuOpen(false);
                        onOpenScenarioModal();
                      }}
                      className="w-full px-3 py-2 text-left flex items-center justify-between text-xs bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <PlayCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>Cenário de Teste</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              14 Passos
                            </span>
                          </div>
                          <div className="text-[10px] text-stone-400">Validação e certificação fiscal AT</div>
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Separador vertical discreto */}
          <div className="h-5 w-px bg-stone-800 hidden sm:block shrink-0" />

          {/* Perfil do Utilizador (Nome e função apresentados no menu do perfil) */}
          <div className="relative shrink-0" ref={profileMenuRef}>
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className={`h-9 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs transition-all shadow-sm focus:outline-none ${
                profileMenuOpen
                  ? 'bg-stone-800 text-white border-stone-600'
                  : 'bg-stone-900/60 hover:bg-stone-900 border border-stone-800/80 hover:border-stone-700 text-stone-200'
              }`}
              title="Abrir menu do perfil do utilizador"
            >
              <span className="text-lg leading-none">{currentUser.avatar}</span>
              <ChevronDown
                className={`w-3 h-3 text-stone-400 transition-transform duration-200 shrink-0 ${
                  profileMenuOpen ? 'rotate-180 text-amber-400' : ''
                }`}
              />
            </button>

            {/* Menu Dropdown do Perfil */}
            {profileMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in py-1.5">
                {/* Cartão de Identificação do Utilizador */}
                <div className="px-3.5 py-3 border-b border-stone-800/80 flex items-center gap-3 bg-stone-950/40">
                  <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-xl shrink-0">
                    {currentUser.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-white text-sm truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-[11px] text-amber-400 font-medium flex items-center gap-1.5 mt-0.5">
                      <span>{roleLabels[currentUser.role] || currentUser.role}</span>
                      {isAdminOrManager && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                          Acesso Total
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Informação do Turno Operacional Atual (Distinto do Utilizador Autenticado) */}
                <div className="px-3.5 py-2 border-b border-stone-800/80 bg-stone-950/20 text-[11px] flex items-center justify-between text-stone-400">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Turno em Execução:</span>
                  </span>
                  <strong className="text-stone-200 font-semibold">{shiftLeaderName}</strong>
                </div>

                {/* Ações do Perfil */}
                <div className="py-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onOpenOperatorModal();
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-xs text-stone-200 hover:bg-stone-800/80 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">Trocar Operador / Autenticar</div>
                      <div className="text-[10px] text-stone-400">Alternar perfil de acesso ou autenticar utilizador</div>
                    </div>
                  </button>

                  {onOpenShiftHandoverModal && (
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onOpenShiftHandoverModal();
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-xs text-stone-200 hover:bg-stone-800/80 transition-colors"
                    >
                      <ArrowRightLeft className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">Passagem de Turno</div>
                        <div className="text-[10px] text-stone-400">Transferir caixa ou turno de serviço</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Guia Modal de Instalação PWA */}
      {showPWAGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 text-stone-100">
            <div className="flex justify-between items-center border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm text-white">Instalar Sabores & Nações</h3>
              </div>
              <button
                onClick={() => setShowPWAGuide(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-300">
              <p>
                Utilize o sistema como aplicação de mão no telemóvel ou tablet, com acesso rápido e ecrã inteiro:
              </p>

              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-2">
                <div className="font-bold text-amber-400">No iPhone ou iPad (Safari):</div>
                <ol className="list-decimal pl-4 space-y-1 text-stone-400">
                  <li>Toque no botão <strong>Partilhar</strong> (ícone de quadrado com seta para cima).</li>
                  <li>Deslize para baixo e toque em <strong>Ecrã Principal / Adicionar ao Ecrã Principal</strong>.</li>
                  <li>Toque em <strong>Adicionar</strong> no canto superior direito.</li>
                </ol>
              </div>

              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-2">
                <div className="font-bold text-amber-400">No Android (Chrome ou Edge):</div>
                <ol className="list-decimal pl-4 space-y-1 text-stone-400">
                  <li>Toque nos <strong>três pontos</strong> do menu no topo do navegador.</li>
                  <li>Selecione <strong>Instalar aplicação</strong> ou <strong>Adicionar ao ecrã inicial</strong>.</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-800">
              <button
                onClick={() => setShowPWAGuide(false)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-md"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
