import { useState, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import {
  Zap, TrendingUp, Building2, CheckCircle2, Search,
  Filter, ChevronUp, ChevronDown, BarChart3, X, RefreshCw, Trophy, Users, Route, History, Calendar
} from 'lucide-react'

// ─── helpers ─────────────────────────────────────────────────────────────────
const parseNum = (v) => {
  if (!v || v === '(Sin valor)') return 0
  return parseFloat(String(v).replace(/,/g, '')) || 0
}

const fmtKwh = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} GWh`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} MWh`
  return `${n.toFixed(0)} kWh`
}

const fmtNum = (n) => new Intl.NumberFormat('es-CO').format(Math.round(n))

const isMR = (d) => d['Tipo de mercado'] === 'Regulado'

const ETAPA_COLOR = {
  'Reunión agendada': 'bg-slate-700 text-slate-200',
  'Análisis comercial': 'bg-yellow-900/60 text-yellow-300',
  'Carta de intención': 'bg-orange-900/60 text-orange-300',
  'Reunión efectiva': 'bg-blue-900/60 text-blue-300',
  'Documentos para firma': 'bg-purple-900/60 text-purple-300',
  'Documentos firmados': 'bg-green-900/60 text-green-300',
  'Fronteras cargadas': 'bg-teal-900/60 text-teal-300',
}

const etapaBase = (etapa) => {
  if (!etapa) return ''
  const m = etapa.match(/^([^(]+)/)
  return m ? m[1].trim() : etapa
}

const etapaBadgeClass = (etapa) => {
  const base = etapaBase(etapa)
  return ETAPA_COLOR[base] || 'bg-slate-700 text-slate-300'
}

const PROB_ORDER = { Alto: 3, Medio: 2, Bajo: 1 }

// ─── sub-components ──────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color, accent }) {
  return (
    <div className={`rounded-2xl p-5 flex flex-col gap-3 border ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest opacity-60">{label}</span>
        <Icon size={18} className={accent} />
      </div>
      <p className={`text-3xl font-bold leading-none ${accent}`}>{value}</p>
      {sub && <p className="text-xs opacity-50">{sub}</p>}
    </div>
  )
}

function Badge({ text, className }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${className}`}>
      {text}
    </span>
  )
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronUp size={12} className="opacity-20" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-blue-400" />
    : <ChevronDown size={12} className="text-blue-400" />
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  )
}

// ─── WON TABLE ───────────────────────────────────────────────────────────────
function WonTable({ mrData, mnrData }) {
  const allWon = useMemo(() => [
    ...mrData.map((r) => ({ ...r, _src: 'MR' })),
    ...mnrData.map((r) => ({ ...r, _src: 'MNR' })),
  ], [mrData, mnrData])

  const [search, setSearch] = useState('')
  const [filterMercado, setFilterMercado] = useState('Todos')
  const [sortCol, setSortCol] = useState('Consumo mensual')
  const [sortDir, setSortDir] = useState('desc')

  const propietarios = useMemo(() =>
    ['Todos', ...new Set(allWon.map((d) => d['Propietario del negocio']).filter(Boolean))].sort(),
    [allWon])
  const [filterPropietario, setFilterPropietario] = useState('Todos')

  const totalMrKwh = useMemo(() => mrData.reduce((s, d) => s + parseNum(d['Consumo mensual']), 0), [mrData])
  const totalMnrKwh = useMemo(() => mnrData.reduce((s, d) => s + parseNum(d['Consumo mensual']), 0), [mnrData])
  const totalKwh = totalMrKwh + totalMnrKwh

  const filtered = useMemo(() => {
    let rows = allWon
    if (filterMercado !== 'Todos') rows = rows.filter((d) => d['Tipo de mercado'] === filterMercado)
    if (filterPropietario !== 'Todos') rows = rows.filter((d) => d['Propietario del negocio'] === filterPropietario)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((d) =>
        d['Nombre del negocio']?.toLowerCase().includes(q) ||
        d['Propietario del negocio']?.toLowerCase().includes(q)
      )
    }
    rows = [...rows].sort((a, b) => {
      if (sortCol === 'Consumo mensual') {
        const av = parseNum(a[sortCol]); const bv = parseNum(b[sortCol])
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const av = (a[sortCol] || '').toLowerCase(); const bv = (b[sortCol] || '').toLowerCase()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return rows
  }, [allWon, filterMercado, filterPropietario, search, sortCol, sortDir])

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('desc') }
  }

  return (
    <div className="space-y-6">
      {/* KPIs Ganados */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Trophy} label="Total Ganados" value={mrData.length + mnrData.length}
          sub="negocios este mes" color="border-yellow-700/30 bg-yellow-900/10" accent="text-yellow-400" />
        <KpiCard icon={Zap} label="kWh Ganados Total" value={fmtKwh(totalKwh)}
          sub={`${fmtNum(totalKwh)} kWh/mes`} color="border-blue-800/40 bg-blue-950/30" accent="text-blue-400" />
        <KpiCard icon={Building2} label="MR Ganados" value={mrData.length}
          sub={fmtKwh(totalMrKwh)} color="border-blue-700/30 bg-blue-900/20" accent="text-blue-300" />
        <KpiCard icon={Building2} label="MNR Ganados" value={mnrData.length}
          sub={fmtKwh(totalMnrKwh)} color="border-emerald-700/30 bg-emerald-900/20" accent="text-emerald-400" />
      </div>

      {/* Barra visual */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <p className="text-xs text-slate-400 mb-3 uppercase tracking-widest font-semibold">Distribución kWh ganados</p>
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-l-full transition-all"
            style={{ width: `${totalKwh ? (totalMrKwh / totalKwh) * 100 : 50}%` }} />
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-r-full transition-all"
            style={{ width: `${totalKwh ? (totalMnrKwh / totalKwh) * 100 : 50}%` }} />
        </div>
        <div className="flex gap-6 mt-2">
          <span className="text-xs text-blue-400">■ MR {totalKwh ? ((totalMrKwh / totalKwh) * 100).toFixed(1) : 0}%</span>
          <span className="text-xs text-emerald-400">■ MNR {totalKwh ? ((totalMnrKwh / totalKwh) * 100).toFixed(1) : 0}%</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Buscar…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
        </div>
        <select value={filterMercado} onChange={(e) => setFilterMercado(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
          <option>Todos</option>
          <option value="Regulado">Regulado (MR)</option>
          <option value="No regulado">No Regulado (MNR)</option>
        </select>
        <select value={filterPropietario} onChange={(e) => setFilterPropietario(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500 max-w-[200px]">
          {propietarios.map((p) => <option key={p}>{p}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} negocios</span>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                {[
                  { col: 'Nombre del negocio', label: 'Negocio' },
                  { col: 'Tipo de mercado', label: 'Mercado' },
                  { col: 'Etapa del negocio', label: 'Etapa' },
                  { col: 'Consumo mensual', label: 'kWh/mes' },
                  { col: 'Propietario del negocio', label: 'Propietario' },
                  { col: 'Autopista', label: 'Autopista' },
                  { col: 'Fecha de cierre', label: 'Fecha cierre' },
                ].map(({ col, label }) => (
                  <th key={col}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none whitespace-nowrap"
                    onClick={() => toggleSort(col)}>
                    <span className="flex items-center gap-1">
                      {label} <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const mr = isMR(row)
                const kwh = parseNum(row['Consumo mensual'])
                return (
                  <tr key={row['Record ID'] || i}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-100 max-w-[240px]">
                      <span className="block truncate" title={row['Nombre del negocio']}>
                        {row['Nombre del negocio'] || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {mr
                        ? <Badge text="MR" className="bg-blue-900/60 text-blue-300 border border-blue-700/30" />
                        : <Badge text="MNR" className="bg-emerald-900/60 text-emerald-300 border border-emerald-700/30" />}
                    </td>
                    <td className="px-4 py-3">
                      {row['Etapa del negocio']
                        ? <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${etapaBadgeClass(row['Etapa del negocio'])}`}>
                            {etapaBase(row['Etapa del negocio'])}
                          </span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-sm">
                      {kwh > 0
                        ? <span className={mr ? 'text-blue-300' : 'text-emerald-300'}>{fmtNum(kwh)}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap text-xs">
                      {row['Propietario del negocio'] || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {row['Autopista'] || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {row['Fecha de cierre']
                        ? row['Fecha de cierre'].slice(0, 10)
                        : '—'}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No se encontraron negocios con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── PIPELINE TABLE ───────────────────────────────────────────────────────────
function PipelineView({ data }) {
  const [search, setSearch] = useState('')
  const [filterMercado, setFilterMercado] = useState('Todos')
  const [filterEtapa, setFilterEtapa] = useState('Todas')
  const [filterPropietario, setFilterPropietario] = useState('Todos')
  const [filterProb, setFilterProb] = useState('Todas')
  const [sortCol, setSortCol] = useState('Consumo mensual')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const kpis = useMemo(() => {
    if (!data.length) return {}
    const mrData = data.filter(isMR)
    const mnrData = data.filter((d) => !isMR(d))
    const totalKwh = data.reduce((s, d) => s + parseNum(d['Consumo mensual']), 0)
    const mrKwh = mrData.reduce((s, d) => s + parseNum(d['Consumo mensual']), 0)
    const mnrKwh = mnrData.reduce((s, d) => s + parseNum(d['Consumo mensual']), 0)
    const altaMed = data.filter((d) =>
      d['Probabilidad de Cierre'] === 'Alto' || d['Probabilidad de Cierre'] === 'Medio'
    )
    const altaMedKwh = altaMed.reduce((s, d) => s + parseNum(d['Consumo mensual']), 0)
    const docsF = data.filter((d) => d['Etapa del negocio']?.toLowerCase().includes('documentos firmados')).length
    return { total: data.length, mrData: mrData.length, mnrData: mnrData.length, totalKwh, mrKwh, mnrKwh, altaMed: altaMed.length, altaMedKwh, docsF }
  }, [data])

  const etapas = useMemo(() => ['Todas', ...new Set(data.map((d) => d['Etapa del negocio']).filter(Boolean))], [data])
  const propietarios = useMemo(() => ['Todos', ...new Set(data.map((d) => d['Propietario del negocio']).filter(Boolean))].sort(), [data])

  const filtered = useMemo(() => {
    let rows = data
    if (filterMercado !== 'Todos') rows = rows.filter((d) => d['Tipo de mercado'] === filterMercado)
    if (filterEtapa !== 'Todas') rows = rows.filter((d) => d['Etapa del negocio'] === filterEtapa)
    if (filterPropietario !== 'Todos') rows = rows.filter((d) => d['Propietario del negocio'] === filterPropietario)
    if (filterProb !== 'Todas') rows = rows.filter((d) => d['Probabilidad de Cierre'] === filterProb)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((d) =>
        d['Nombre del negocio']?.toLowerCase().includes(q) ||
        d['Propietario del negocio']?.toLowerCase().includes(q)
      )
    }
    rows = [...rows].sort((a, b) => {
      if (sortCol === 'Consumo mensual') {
        return sortDir === 'asc' ? parseNum(a[sortCol]) - parseNum(b[sortCol]) : parseNum(b[sortCol]) - parseNum(a[sortCol])
      }
      if (sortCol === 'Probabilidad de Cierre') {
        const av = PROB_ORDER[a[sortCol]] || 0; const bv = PROB_ORDER[b[sortCol]] || 0
        return sortDir === 'asc' ? av - bv : bv - av
      }
      const av = (a[sortCol] || '').toLowerCase(); const bv = (b[sortCol] || '').toLowerCase()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return rows
  }, [data, filterMercado, filterEtapa, filterPropietario, filterProb, search, sortCol, sortDir])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('desc') }
    setPage(1)
  }

  const hasFilters = search || filterMercado !== 'Todos' || filterEtapa !== 'Todas' || filterPropietario !== 'Todos' || filterProb !== 'Todas'

  return (
    <div className="space-y-6">
      {/* KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon={Zap} label="Total Pipeline kWh" value={fmtKwh(kpis.totalKwh)}
          sub={`${fmtNum(kpis.totalKwh)} kWh/mes`} color="border-blue-800/40 bg-blue-950/30" accent="text-blue-400" />
        <KpiCard icon={Building2} label="MR – Regulado" value={fmtKwh(kpis.mrKwh)}
          sub={`${kpis.mrData} negocios`} color="border-blue-700/30 bg-blue-900/20" accent="text-blue-300" />
        <KpiCard icon={Building2} label="MNR – No Regulado" value={fmtKwh(kpis.mnrKwh)}
          sub={`${kpis.mnrData} negocios`} color="border-emerald-700/30 bg-emerald-900/20" accent="text-emerald-400" />
        <KpiCard icon={CheckCircle2} label="Docs Firmados" value={kpis.docsF}
          sub="etapa más avanzada" color="border-green-700/30 bg-green-900/20" accent="text-green-400" />
        <KpiCard icon={TrendingUp} label="Prob. Alta + Media" value={kpis.altaMed}
          sub={fmtKwh(kpis.altaMedKwh)} color="border-purple-700/30 bg-purple-900/20" accent="text-purple-400" />
        <KpiCard icon={Zap} label="Total Negocios" value={kpis.total}
          sub={`MR ${kpis.mrData} · MNR ${kpis.mnrData}`} color="border-slate-700/40 bg-slate-800/30" accent="text-slate-300" />
      </div>

      {/* Barras MR / MNR */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-blue-800/30 bg-blue-950/20 p-5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-widest">Mercado Regulado (MR)</span>
            <span className="text-lg font-bold text-blue-400">{fmtKwh(kpis.mrKwh)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
              style={{ width: `${kpis.totalKwh ? (kpis.mrKwh / kpis.totalKwh) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {kpis.totalKwh ? ((kpis.mrKwh / kpis.totalKwh) * 100).toFixed(1) : 0}% del pipeline · {kpis.mrData} negocios
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-800/30 bg-emerald-950/20 p-5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-widest">Mercado No Regulado (MNR)</span>
            <span className="text-lg font-bold text-emerald-400">{fmtKwh(kpis.mnrKwh)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
              style={{ width: `${kpis.totalKwh ? (kpis.mnrKwh / kpis.totalKwh) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {kpis.totalKwh ? ((kpis.mnrKwh / kpis.totalKwh) * 100).toFixed(1) : 0}% del pipeline · {kpis.mnrData} negocios
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Filtros</span>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterMercado('Todos'); setFilterEtapa('Todas'); setFilterPropietario('Todos'); setFilterProb('Todas'); setPage(1) }}
              className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors">
              <X size={12} /> Limpiar
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Buscar negocio o propietario…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          </div>
          <select value={filterMercado} onChange={(e) => { setFilterMercado(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
            <option>Todos</option>
            <option value="Regulado">Regulado (MR)</option>
            <option value="No regulado">No Regulado (MNR)</option>
          </select>
          <select value={filterProb} onChange={(e) => { setFilterProb(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
            <option value="Todas">Probabilidad</option>
            <option value="Alto">Alta</option>
            <option value="Medio">Media</option>
            <option value="Bajo">Baja</option>
          </select>
          <select value={filterEtapa} onChange={(e) => { setFilterEtapa(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500 max-w-[220px]">
            {etapas.map((e) => <option key={e}>{e}</option>)}
          </select>
          <select value={filterPropietario} onChange={(e) => { setFilterPropietario(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500 max-w-[200px]">
            {propietarios.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-500">{filtered.length} negocios encontrados</p>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                {[
                  { col: 'Nombre del negocio', label: 'Negocio' },
                  { col: 'Tipo de mercado', label: 'Mercado' },
                  { col: 'Etapa del negocio', label: 'Etapa' },
                  { col: 'Probabilidad de Cierre', label: 'Prob.' },
                  { col: 'Consumo mensual', label: 'kWh/mes' },
                  { col: 'Propietario del negocio', label: 'Propietario' },
                  { col: 'Subautopista', label: 'Sub.' },
                  { col: 'Fecha de cierre', label: 'Cierre' },
                ].map(({ col, label }) => (
                  <th key={col}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none whitespace-nowrap"
                    onClick={() => toggleSort(col)}>
                    <span className="flex items-center gap-1">
                      {label} <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((row, i) => {
                const mr = isMR(row)
                const kwh = parseNum(row['Consumo mensual'])
                return (
                  <tr key={row['Negocio ID'] || i}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-100 max-w-[220px]">
                      <span className="block truncate" title={row['Nombre del negocio']}>{row['Nombre del negocio'] || '—'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {mr
                        ? <Badge text="MR" className="bg-blue-900/60 text-blue-300 border border-blue-700/30" />
                        : <Badge text="MNR" className="bg-emerald-900/60 text-emerald-300 border border-emerald-700/30" />}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${etapaBadgeClass(row['Etapa del negocio'])}`}
                        title={row['Etapa del negocio']}>
                        {etapaBase(row['Etapa del negocio']) || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row['Probabilidad de Cierre'] === 'Alto' && <Badge text="Alta" className="bg-green-900/50 text-green-300" />}
                      {row['Probabilidad de Cierre'] === 'Medio' && <Badge text="Media" className="bg-yellow-900/50 text-yellow-300" />}
                      {row['Probabilidad de Cierre'] === 'Bajo' && <Badge text="Baja" className="bg-slate-700/80 text-slate-400" />}
                      {!['Alto', 'Medio', 'Bajo'].includes(row['Probabilidad de Cierre']) && <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-sm">
                      {kwh > 0
                        ? <span className={mr ? 'text-blue-300' : 'text-emerald-300'}>{fmtNum(kwh)}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap text-xs">{row['Propietario del negocio'] || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {row['Subautopista'] && row['Subautopista'] !== '(Sin valor)' ? row['Subautopista'] : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {row['Fecha de cierre'] && row['Fecha de cierre'] !== '(Sin valor)'
                        ? row['Fecha de cierre'] : '—'}
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No se encontraron negocios.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900/40">
            <p className="text-xs text-slate-500">Página {page} de {totalPages} · {filtered.length} negocios</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition-colors">
                ← Anterior
              </button>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition-colors">
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── helpers de agrupación ────────────────────────────────────────────────────
function groupBy(rows, key) {
  const map = {}
  rows.forEach((r) => {
    const k = r[key] || '(Sin valor)'
    if (!map[k]) map[k] = { mr: [], mnr: [] }
    if (r['Tipo de mercado'] === 'Regulado') map[k].mr.push(r)
    else map[k].mnr.push(r)
  })
  return Object.entries(map)
    .map(([name, { mr, mnr }]) => {
      const mrKwh = mr.reduce((s, d) => s + parseNum(d['Consumo mensual']), 0)
      const mnrKwh = mnr.reduce((s, d) => s + parseNum(d['Consumo mensual']), 0)
      return {
        name,
        mrCount: mr.length, mnrCount: mnr.length,
        total: mr.length + mnr.length,
        mrKwh, mnrKwh, totalKwh: mrKwh + mnrKwh,
      }
    })
    .sort((a, b) => b.totalKwh - a.totalKwh)
}

function RankingBar({ value, max, color }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  )
}

// ─── POR KAM ──────────────────────────────────────────────────────────────────
const KAMS_CON_META = new Set([
  'Sebastian Mazorra Gomez',
  'Andrés Toro García',
  'Daniela Dueñas Camacho',
  'Juan Pablo Blanco Lugo',
  'Alejandro Sánchez Jiménez',
  'Miguel Charry Sierra',
])
const META_PUNTOS = 14

// Excepciones manuales: { nombre_negocio: puntos }
const EXCEPCIONES_PUNTOS = {
  'ARCOS DORADOS COLOMBIA S A S': 10,
}

function puntosNegocio(kwh, nombre = '') {
  if (EXCEPCIONES_PUNTOS[nombre?.trim()]) return EXCEPCIONES_PUNTOS[nombre.trim()]
  if (kwh > 450000) return 12
  if (kwh >= 100000) return 6
  if (kwh >= 40000)  return 3
  if (kwh >= 10000)  return 2
  if (kwh > 0)       return 1
  return 0
}

function ptosBadge(p) {
  if (p === 12) return 'bg-purple-900/70 text-purple-300 border border-purple-700/40'
  if (p === 6)  return 'bg-blue-900/70 text-blue-300 border border-blue-700/40'
  if (p === 3)  return 'bg-teal-900/70 text-teal-300 border border-teal-700/40'
  if (p === 2)  return 'bg-yellow-900/70 text-yellow-300 border border-yellow-700/40'
  return 'bg-slate-700/70 text-slate-400 border border-slate-600/40'
}

function KamView({ mrData, mnrData }) {
  const allWon = useMemo(() => [...mrData, ...mnrData], [mrData, mnrData])
  const rows = useMemo(() => groupBy(allWon, 'Propietario del negocio'), [allWon])
  const maxKwh = rows[0]?.totalKwh || 1
  const totalNegocios = allWon.length
  const totalKwh = allWon.reduce((s, d) => s + parseNum(d['Consumo mensual']), 0)

  // Performance por KAM con meta
  const performance = useMemo(() => {
    const map = {}
    allWon.forEach((r) => {
      const kam = r['Propietario del negocio']
      if (!KAMS_CON_META.has(kam)) return
      if (!map[kam]) map[kam] = { puntos: 0, deals: [] }
      const kwh = parseNum(r['Consumo mensual'])
      const p = puntosNegocio(kwh, r['Nombre del negocio'])
      map[kam].puntos += p
      map[kam].deals.push({ nombre: r['Nombre del negocio'], kwh, puntos: p, excepcion: !!EXCEPCIONES_PUNTOS[r['Nombre del negocio']?.trim()] })
    })
    return Object.entries(map)
      .map(([kam, d]) => ({ kam, ...d }))
      .sort((a, b) => b.puntos - a.puntos)
  }, [allWon])

  const cumple = performance.filter((k) => k.puntos >= META_PUNTOS).length
  const [expandedKam, setExpandedKam] = useState(null)

  return (
    <div className="space-y-6">
      {/* KPIs resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="KAMs activos" value={rows.length}
          sub="con negocios ganados" color="border-blue-800/40 bg-blue-950/30" accent="text-blue-400" />
        <KpiCard icon={Trophy} label="Total ganados" value={totalNegocios}
          sub="negocios este mes" color="border-yellow-700/30 bg-yellow-900/10" accent="text-yellow-400" />
        <KpiCard icon={CheckCircle2} label="KAMs que cumplen" value={`${cumple}/${performance.length}`}
          sub={`meta: ${META_PUNTOS} puntos`} color="border-green-700/30 bg-green-900/20" accent="text-green-400" />
        <KpiCard icon={Zap} label="kWh total ganado" value={fmtKwh(totalKwh)}
          sub={`${fmtNum(totalKwh)} kWh/mes`} color="border-purple-700/30 bg-purple-900/20" accent="text-purple-400" />
      </div>

      {/* ── PERFORMANCE CON META ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Performance · Meta {META_PUNTOS} puntos</span>
          <span className="ml-2 text-[10px] text-slate-500">Click en un KAM para ver el detalle de negocios</span>
        </div>

        {/* Tabla de puntos */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden mb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">KAM</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Negocios</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Puntos</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Progreso a meta</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((k, i) => {
                  const pct = Math.min((k.puntos / META_PUNTOS) * 100, 100)
                  const cumpleK = k.puntos >= META_PUNTOS
                  const isOpen = expandedKam === k.kam
                  return (
                    <>
                      <tr key={k.kam}
                        className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors cursor-pointer"
                        onClick={() => setExpandedKam(isOpen ? null : k.kam)}>
                        <td className="px-5 py-4 text-slate-500 font-mono text-xs">{i + 1}</td>
                        <td className="px-5 py-4 font-semibold text-white">
                          <span className="flex items-center gap-2">
                            {k.kam}
                            <ChevronDown size={12} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center text-slate-300">{k.deals.length}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`text-lg font-bold ${cumpleK ? 'text-green-400' : 'text-yellow-400'}`}>
                            {k.puntos}
                          </span>
                          <span className="text-slate-600 text-xs">/{META_PUNTOS}</span>
                        </td>
                        <td className="px-5 py-4 min-w-[200px]">
                          <div className="space-y-1">
                            <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${cumpleK ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-yellow-700 to-yellow-500'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {cumpleK ? `+${k.puntos - META_PUNTOS} sobre meta` : `Faltan ${META_PUNTOS - k.puntos} pts`}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {cumpleK
                            ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-900/50 text-green-400 text-xs font-bold border border-green-700/40">✅ Cumple</span>
                            : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-900/40 text-red-400 text-xs font-bold border border-red-700/40">❌ En proceso</span>
                          }
                        </td>
                      </tr>
                      {/* Detalle de negocios expandible */}
                      {isOpen && (
                        <tr key={`${k.kam}-detail`} className="border-b border-slate-800">
                          <td colSpan={6} className="px-5 pb-4 pt-0 bg-slate-900/60">
                            <div className="rounded-xl border border-slate-700/50 overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-slate-800/60 border-b border-slate-700/50">
                                    <th className="px-4 py-2 text-left text-slate-400 font-semibold">Negocio</th>
                                    <th className="px-4 py-2 text-right text-slate-400 font-semibold">kWh/mes</th>
                                    <th className="px-4 py-2 text-center text-slate-400 font-semibold">Puntos</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {k.deals.sort((a, b) => b.puntos - a.puntos).map((d, di) => (
                                    <tr key={di} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                                      <td className="px-4 py-2 text-slate-200">
                                        {d.nombre}
                                        {d.excepcion && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">excepción</span>}
                                      </td>
                                      <td className="px-4 py-2 text-right font-mono text-blue-300">{fmtNum(d.kwh)}</td>
                                      <td className="px-4 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ptosBadge(d.puntos)}`}>
                                          {d.puntos} {d.puntos === 1 ? 'pt' : 'pts'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="bg-slate-800/40">
                                    <td className="px-4 py-2 font-bold text-white">Total</td>
                                    <td className="px-4 py-2 text-right font-mono text-white font-bold">{fmtNum(k.deals.reduce((s, d) => s + d.kwh, 0))}</td>
                                    <td className="px-4 py-2 text-center font-bold text-white">{k.puntos} pts</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leyenda de puntos */}
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] text-slate-500 mr-1 self-center">Tabla de puntos:</span>
          {[
            { label: '>450k kWh', pts: 12, cls: 'bg-purple-900/70 text-purple-300 border-purple-700/40' },
            { label: '100k–449k kWh', pts: 6, cls: 'bg-blue-900/70 text-blue-300 border-blue-700/40' },
            { label: '40k–99k kWh', pts: 3, cls: 'bg-teal-900/70 text-teal-300 border-teal-700/40' },
            { label: '10k–39k kWh', pts: 2, cls: 'bg-yellow-900/70 text-yellow-300 border-yellow-700/40' },
            { label: '0–9k kWh', pts: 1, cls: 'bg-slate-700/70 text-slate-400 border-slate-600/40' },
          ].map(({ label, pts, cls }) => (
            <span key={pts} className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${cls}`}>
              {label} → {pts} {pts === 1 ? 'pt' : 'pts'}
            </span>
          ))}
        </div>
      </div>

      {/* ── RANKING GENERAL (todos los KAMs) ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <Users size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Ranking general por kWh · todos los KAMs</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-8">#</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">KAM</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Negocios</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-blue-400 uppercase tracking-wider">MR</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-emerald-400 uppercase tracking-wider">MNR</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">kWh Total</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">% del total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name} className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3 text-slate-500 font-mono text-xs">{i + 1}</td>
                  <td className="px-5 py-3 font-semibold text-slate-100">
                    {r.name}
                    {KAMS_CON_META.has(r.name) && <span className="ml-2 text-[10px] text-slate-500">· con meta</span>}
                  </td>
                  <td className="px-5 py-3 text-center font-bold text-white">{r.total}</td>
                  <td className="px-5 py-3 text-center text-blue-300">{r.mrCount || '—'}</td>
                  <td className="px-5 py-3 text-center text-emerald-300">{r.mnrCount || '—'}</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-white">{fmtKwh(r.totalKwh)}</td>
                  <td className="px-5 py-3 w-32">
                    <div className="space-y-1">
                      <RankingBar value={r.totalKwh} max={maxKwh} color="bg-gradient-to-r from-blue-600 to-purple-500" />
                      <span className="text-[10px] text-slate-500">{totalKwh ? ((r.totalKwh / totalKwh) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── POR AUTOPISTA ────────────────────────────────────────────────────────────
function groupSubautopista(rows, autopista) {
  const filtered = rows.filter((r) => (r['Autopista'] || '') === autopista)
  const map = {}
  filtered.forEach((r) => {
    const sub = r['Subautopista'] || r['subautopista'] || '(Sin sub)'
    const k = sub.trim() || '(Sin sub)'
    if (!map[k]) map[k] = { count: 0, kwh: 0 }
    map[k].count++
    map[k].kwh += parseNum(r['Consumo mensual'])
  })
  return Object.entries(map)
    .map(([name, { count, kwh }]) => ({ name, count, kwh }))
    .sort((a, b) => b.kwh - a.kwh)
}

function AutopistaView({ mrData, mnrData }) {
  const allWon = useMemo(() => [...mrData, ...mnrData], [mrData, mnrData])
  const rows = useMemo(() => groupBy(allWon, 'Autopista'), [allWon])
  const maxKwh = rows[0]?.totalKwh || 1
  const totalNegocios = allWon.length
  const totalKwh = allWon.reduce((s, d) => s + parseNum(d['Consumo mensual']), 0)

  const AUTOPISTA_COLOR = {
    Especiales: { bg: 'bg-blue-500', border: 'border-blue-700/40', card: 'bg-blue-950/20', text: 'text-blue-400', bar: 'bg-gradient-to-r from-blue-700 to-blue-400' },
    Inbound:    { bg: 'bg-emerald-500', border: 'border-emerald-700/40', card: 'bg-emerald-950/20', text: 'text-emerald-400', bar: 'bg-gradient-to-r from-emerald-700 to-emerald-400' },
    Outbound:   { bg: 'bg-purple-500', border: 'border-purple-700/40', card: 'bg-purple-950/20', text: 'text-purple-400', bar: 'bg-gradient-to-r from-purple-700 to-purple-400' },
    Partnerships: { bg: 'bg-orange-500', border: 'border-orange-700/40', card: 'bg-orange-950/20', text: 'text-orange-400', bar: 'bg-gradient-to-r from-orange-700 to-orange-400' },
  }
  const DEFAULT_COLOR = { bg: 'bg-slate-500', border: 'border-slate-700/40', card: 'bg-slate-800/30', text: 'text-slate-400', bar: 'bg-slate-500' }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard icon={Route} label="Autopistas activas" value={rows.length}
          sub="con al menos 1 negocio ganado" color="border-blue-800/40 bg-blue-950/30" accent="text-blue-400" />
        <KpiCard icon={Trophy} label="Total ganados" value={totalNegocios}
          sub="negocios este mes" color="border-yellow-700/30 bg-yellow-900/10" accent="text-yellow-400" />
        <KpiCard icon={Zap} label="kWh total ganado" value={fmtKwh(totalKwh)}
          sub={`${fmtNum(totalKwh)} kWh/mes`} color="border-purple-700/30 bg-purple-900/20" accent="text-purple-400" />
      </div>

      {/* Tarjetas por autopista con sub-autopistas */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {rows.map((r) => {
          const c = AUTOPISTA_COLOR[r.name] || DEFAULT_COLOR
          const subs = groupSubautopista(allWon, r.name)
          const maxSubKwh = subs[0]?.kwh || 1
          return (
            <div key={r.name} className={`rounded-2xl border ${c.border} ${c.card} p-5 space-y-4`}>
              {/* header */}
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-base">{r.name}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold text-white ${c.bg}`}>
                  {r.total} {r.total === 1 ? 'negocio' : 'negocios'}
                </span>
              </div>

              {/* barra kWh total */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-500">kWh total</span>
                  <span className={`text-sm font-bold ${c.text}`}>{fmtKwh(r.totalKwh)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${(r.totalKwh / maxKwh) * 100}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{totalKwh ? ((r.totalKwh / totalKwh) * 100).toFixed(1) : 0}% del total</p>
              </div>

              {/* split MR / MNR */}
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-800/60">
                <div>
                  <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mb-1">MR</p>
                  <p className="text-sm font-bold text-blue-300">{r.mrCount} neg. · {fmtKwh(r.mrKwh)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-1">MNR</p>
                  <p className="text-sm font-bold text-emerald-300">{r.mnrCount} neg. · {fmtKwh(r.mnrKwh)}</p>
                </div>
              </div>

              {/* Sub-autopistas */}
              {subs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Sub-autopistas</p>
                  {subs.map((s) => (
                    <div key={s.name} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-300">{s.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">{s.count} neg.</span>
                          <span className={`text-xs font-semibold ${c.text}`}>{fmtKwh(s.kwh)}</span>
                        </div>
                      </div>
                      <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full ${c.bar} opacity-70`}
                          style={{ width: `${(s.kwh / maxSubKwh) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Tabla resumen */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <Route size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Resumen por autopista · sub-autopista</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Autopista</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Sub-autopista</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Negocios</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">kWh</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Participación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = AUTOPISTA_COLOR[r.name] || DEFAULT_COLOR
                const subs = groupSubautopista(allWon, r.name)
                return subs.map((s, si) => (
                  <tr key={`${r.name}-${s.name}`} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                    {si === 0 && (
                      <td className="px-5 py-3 font-bold text-white align-top" rowSpan={subs.length}>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white ${c.bg} mb-1`}>{r.name}</span>
                        <p className="text-xs text-slate-500">{r.total} neg. · {fmtKwh(r.totalKwh)}</p>
                      </td>
                    )}
                    <td className="px-5 py-3 text-slate-300 text-xs">{s.name}</td>
                    <td className="px-5 py-3 text-center font-medium text-white">{s.count}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-white">{fmtKwh(s.kwh)}</td>
                    <td className="px-5 py-3 w-28">
                      <div className="space-y-1">
                        <RankingBar value={s.kwh} max={maxKwh} color={c.bar} />
                        <span className="text-[10px] text-slate-500">{totalKwh ? ((s.kwh / totalKwh) * 100).toFixed(1) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── HISTORICO ───────────────────────────────────────────────────────────────

const MESES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const MONTH_DATE_MAP = {
  abril: new Date(2026, 3, 15),
  mayo:  new Date(2026, 4, 15),
}

function getPeriodKey(date, type) {
  const y = date.getFullYear()
  const m = date.getMonth()
  if (type === 'mes')       return `${y}-${String(m + 1).padStart(2, '0')}`
  if (type === 'trimestre') return `${y}-Q${Math.floor(m / 3) + 1}`
  if (type === 'semestre')  return `${y}-S${m < 6 ? 1 : 2}`
  return `${y}`
}

function getPeriodLabel(key, type) {
  if (type === 'mes') {
    const [y, mo] = key.split('-')
    return `${MESES_LABEL[parseInt(mo, 10) - 1]} ${y}`
  }
  if (type === 'trimestre') {
    const [y, q] = key.split('-')
    return `${q} ${y}`
  }
  if (type === 'semestre') {
    const [y, s] = key.split('-')
    return `${s} ${y}`
  }
  return key
}

function resolveDate(row) {
  // Metabase historical data uses date_signed_contract
  const rawDate = row['date_signed_contract'] || row['Fecha de cierre']
  if (rawDate && rawDate !== '(Sin valor)') {
    const d = new Date(rawDate)
    if (!isNaN(d)) return d
  }
  return MONTH_DATE_MAP[row._monthKey] || null
}

function normalizeHistorico(row) {
  return {
    'Record ID':              row['lead_id'],
    'Nombre del negocio':     row['lead_name'] || row['partner_name'],
    'Tipo de mercado':        row['x_studio_t_mercado'],
    'Consumo mensual':        row['x_studio_consumo_kwh'],
    'Propietario del negocio': row['source'],
    'Autopista':              row['autopista'],
    'Sub-autopista':          row['sub_source'],
    'Fecha de cierre':        row['date_signed_contract'],
    _monthKey:                null,
  }
}

function HistoricoBarChart({ items, periodoTab }) {
  const max = Math.max(...items.map((d) => d.total), 1)
  const BAR_H = 160

  return (
    <div className="w-full">
      <div className="flex items-end gap-1 w-full">
        {items.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center group min-w-0">

            {/* Área de la barra */}
            <div className="relative w-full flex flex-col justify-end" style={{ height: `${BAR_H}px` }}>

              {/* Tooltip al hacer hover */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                <div className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white whitespace-nowrap shadow-xl">
                  <div className="font-semibold text-slate-300 mb-1">{d.label}</div>
                  <div className="font-bold text-lg text-white leading-none">{d.total} cierres</div>
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-blue-300">
                      <span className="inline-block w-2 h-2 rounded-sm bg-blue-500" /> MR: <span className="font-bold">{d.mrCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-300">
                      <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" /> MNR: <span className="font-bold">{d.mnrCount}</span>
                    </div>
                  </div>
                </div>
                <div className="w-2 h-2 bg-slate-700 border-r border-b border-slate-600 rotate-45 -mt-1" />
              </div>

              {/* Barra apilada */}
              <div className="w-full rounded-t overflow-hidden flex flex-col-reverse"
                style={{ height: `${Math.max((d.total / max) * (BAR_H - 8), d.total > 0 ? 3 : 0)}px` }}>
                <div className="w-full bg-gradient-to-t from-blue-700 to-blue-500"
                  style={{ height: `${d.total ? (d.mrCount / d.total) * 100 : 0}%` }} />
                <div className="w-full bg-gradient-to-t from-emerald-700 to-emerald-500"
                  style={{ height: `${d.total ? (d.mnrCount / d.total) * 100 : 0}%` }} />
              </div>
            </div>

            {/* Etiqueta vertical debajo */}
            <div className="mt-1 flex justify-center" style={{ height: '60px' }}>
              <span className="text-[9px] text-slate-500 whitespace-nowrap"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', lineHeight: 1 }}>
                {d.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HistoricoView({ allData }) {
  const [periodoTab, setPeriodoTab] = useState('mes')
  const [search, setSearch] = useState('')
  const [filterMercado, setFilterMercado] = useState('Todos')
  const [filterKam, setFilterKam] = useState('Todos')
  const [filterMes, setFilterMes] = useState('Todos')
  const [sortCol, setSortCol] = useState('_date')
  const [sortDir, setSortDir] = useState('desc')

  const dataWithDates = useMemo(() =>
    allData
      .map((r) => ({ ...r, _date: resolveDate(r) }))
      .filter((r) => r._date !== null),
    [allData]
  )

  const totalClientes = dataWithDates.length
  const totalMR  = dataWithDates.filter((r) => r['Tipo de mercado'] === 'Regulado').length
  const totalMNR = dataWithDates.filter((r) => r['Tipo de mercado'] === 'No regulado').length
  const totalKwh = dataWithDates.reduce((s, r) => s + parseNum(r['Consumo mensual']), 0)

  // Agrupar por periodo
  const chartItems = useMemo(() => {
    const map = {}
    dataWithDates.forEach((r) => {
      const key = getPeriodKey(r._date, periodoTab)
      if (!map[key]) map[key] = { key, total: 0, mrCount: 0, mnrCount: 0 }
      map[key].total++
      if (r['Tipo de mercado'] === 'Regulado') map[key].mrCount++
      else map[key].mnrCount++
    })
    return Object.values(map)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((d) => ({ ...d, label: getPeriodLabel(d.key, periodoTab) }))
  }, [dataWithDates, periodoTab])

  const kams = useMemo(() =>
    ['Todos', ...new Set(dataWithDates.map((r) => r['Propietario del negocio']).filter(Boolean))].sort(),
    [dataWithDates]
  )

  // Meses disponibles para el filtro de la tabla
  const mesesDisponibles = useMemo(() => {
    const set = new Set(
      dataWithDates.map((r) => getPeriodKey(r._date, 'mes'))
    )
    const sorted = [...set].sort()
    return ['Todos', ...sorted.map((k) => ({ key: k, label: getPeriodLabel(k, 'mes') }))]
  }, [dataWithDates])

  const filtered = useMemo(() => {
    let rows = dataWithDates
    if (filterMercado !== 'Todos') rows = rows.filter((r) => r['Tipo de mercado'] === filterMercado)
    if (filterKam !== 'Todos')     rows = rows.filter((r) => r['Propietario del negocio'] === filterKam)
    if (filterMes !== 'Todos')     rows = rows.filter((r) => getPeriodKey(r._date, 'mes') === filterMes)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((r) =>
        r['Nombre del negocio']?.toLowerCase().includes(q) ||
        r['Propietario del negocio']?.toLowerCase().includes(q)
      )
    }
    rows = [...rows].sort((a, b) => {
      if (sortCol === '_date') {
        const av = a._date?.getTime() || 0; const bv = b._date?.getTime() || 0
        return sortDir === 'asc' ? av - bv : bv - av
      }
      if (sortCol === 'Consumo mensual') {
        return sortDir === 'asc'
          ? parseNum(a[sortCol]) - parseNum(b[sortCol])
          : parseNum(b[sortCol]) - parseNum(a[sortCol])
      }
      const av = (a[sortCol] || '').toLowerCase()
      const bv = (b[sortCol] || '').toLowerCase()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    return rows
  }, [dataWithDates, filterMercado, filterKam, search, sortCol, sortDir])

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('desc') }
  }

  const PERIODO_TABS = [
    { key: 'mes',       label: 'Por Mes' },
    { key: 'trimestre', label: 'Por Trimestre' },
    { key: 'semestre',  label: 'Por Semestre' },
    { key: 'año',       label: 'Por Año' },
  ]

  return (
    <div className="space-y-6">
      {/* ── KPIs TOTALES ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Trophy} label="Clientes Firmados" value={totalClientes}
          sub="histórico total" color="border-yellow-700/30 bg-yellow-900/10" accent="text-yellow-400" />
        <KpiCard icon={Zap} label="kWh Total Cerrado" value={fmtKwh(totalKwh)}
          sub={`${fmtNum(totalKwh)} kWh/mes`} color="border-blue-800/40 bg-blue-950/30" accent="text-blue-400" />
        <KpiCard icon={Building2} label="MR Firmados" value={totalMR}
          sub={`${totalClientes ? ((totalMR / totalClientes) * 100).toFixed(1) : 0}% del total`}
          color="border-blue-700/30 bg-blue-900/20" accent="text-blue-300" />
        <KpiCard icon={Building2} label="MNR Firmados" value={totalMNR}
          sub={`${totalClientes ? ((totalMNR / totalClientes) * 100).toFixed(1) : 0}% del total`}
          color="border-emerald-700/30 bg-emerald-900/20" accent="text-emerald-400" />
      </div>

      {/* ── GRÁFICO DE TENDENCIA ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Tendencia de Cierres</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1 border border-slate-700/50">
            {PERIODO_TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setPeriodoTab(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  periodoTab === key
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {chartItems.length > 0 ? (
          <>
            <HistoricoBarChart items={chartItems} periodoTab={periodoTab} />
            <div className="flex items-center gap-6 pt-2 border-t border-slate-800">
              <span className="text-xs text-blue-400 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> MR (Regulado)
              </span>
              <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> MNR (No Regulado)
              </span>
              <span className="text-xs text-slate-500 ml-auto">
                {chartItems.length} {periodoTab === 'mes' ? 'meses' : periodoTab === 'trimestre' ? 'trimestres' : periodoTab === 'semestre' ? 'semestres' : 'años'} con actividad
              </span>
            </div>
          </>
        ) : (
          <p className="text-slate-500 text-sm py-8 text-center">Sin datos históricos disponibles.</p>
        )}
      </div>

      {/* ── TABLA DE CLIENTES ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Clientes Firmados · Histórico</span>
        </div>

        {/* Filtros */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Buscar cliente…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          </div>
          {/* Filtro mes de cierre */}
          <select value={filterMes} onChange={(e) => setFilterMes(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
            {mesesDisponibles.map((m) =>
              m === 'Todos'
                ? <option key="todos" value="Todos">Todos los meses</option>
                : <option key={m.key} value={m.key}>{m.label}</option>
            )}
          </select>
          <select value={filterMercado} onChange={(e) => setFilterMercado(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
            <option>Todos</option>
            <option value="Regulado">Regulado (MR)</option>
            <option value="No regulado">No Regulado (MNR)</option>
          </select>
          <select value={filterKam} onChange={(e) => setFilterKam(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-blue-500 max-w-[200px]">
            {kams.map((k) => <option key={k}>{k}</option>)}
          </select>
          {(search || filterMercado !== 'Todos' || filterKam !== 'Todos' || filterMes !== 'Todos') && (
            <button onClick={() => { setSearch(''); setFilterMercado('Todos'); setFilterKam('Todos'); setFilterMes('Todos') }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors">
              <X size={12} /> Limpiar
            </button>
          )}
          <span className="text-xs text-slate-500 ml-auto">{filtered.length} clientes</span>
        </div>

        {/* Tabla */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  {[
                    { col: 'Nombre del negocio', label: 'Cliente' },
                    { col: 'Tipo de mercado',    label: 'Mercado' },
                    { col: 'Consumo mensual',    label: 'kWh/mes' },
                    { col: 'Propietario del negocio', label: 'KAM' },
                    { col: 'Autopista',          label: 'Autopista' },
                    { col: '_date',              label: 'Fecha cierre' },
                  ].map(({ col, label }) => (
                    <th key={col}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none whitespace-nowrap"
                      onClick={() => toggleSort(col)}>
                      <span className="flex items-center gap-1">
                        {label} <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const mr = row['Tipo de mercado'] === 'Regulado'
                  const kwh = parseNum(row['Consumo mensual'])
                  return (
                    <tr key={row['Record ID'] || i}
                      className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-100 max-w-[240px]">
                        <span className="block truncate" title={row['Nombre del negocio']}>
                          {row['Nombre del negocio'] || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {mr
                          ? <Badge text="MR"  className="bg-blue-900/60 text-blue-300 border border-blue-700/30" />
                          : <Badge text="MNR" className="bg-emerald-900/60 text-emerald-300 border border-emerald-700/30" />}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-sm">
                        {kwh > 0
                          ? <span className={mr ? 'text-blue-300' : 'text-emerald-300'}>{fmtNum(kwh)}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap text-xs">
                        {row['Propietario del negocio'] || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {row['Autopista'] || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {row._date
                          ? row._date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      No se encontraron clientes con los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MONTH SELECTOR ──────────────────────────────────────────────────────────
const MESES = [
  { key: 'abril', label: 'Abril 2026' },
  { key: 'mayo',  label: 'Mayo 2026'  },
]

function MonthSelector({ selected, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1 border border-slate-700/50">
      {MESES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            selected === key
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [pipeline,   setPipeline]   = useState([])
  const [abrilMR,    setAbrilMR]    = useState([])
  const [abrilMNR,   setAbrilMNR]   = useState([])
  const [mayoMR,     setMayoMR]     = useState([])
  const [mayoMNR,    setMayoMNR]    = useState([])
  const [historico,  setHistorico]  = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pipeline')
  const [selectedMonth, setSelectedMonth] = useState('mayo')

  useEffect(() => {
    const loadCsv = (url, monthKey) =>
      fetch(url).then((r) => r.text()).then((text) => {
        const rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data
        return monthKey ? rows.map((r) => ({ ...r, _monthKey: monthKey })) : rows
      }).catch(() => [])

    const base = import.meta.env.BASE_URL
    Promise.all([
      loadCsv(`${base}hubspot-export-summary.csv`),
      loadCsv(`${base}abril/won-mr.csv`,  'abril'),
      loadCsv(`${base}abril/won-mnr.csv`, 'abril'),
      loadCsv(`${base}mayo/won-mr.csv`,   'mayo'),
      loadCsv(`${base}mayo/won-mnr.csv`,  'mayo'),
      loadCsv(`${base}historico.csv`),
    ]).then(([p, aMR, aMNR, mMR, mMNR, hist]) => {
      setPipeline(p)
      setAbrilMR(aMR);  setAbrilMNR(aMNR)
      setMayoMR(mMR);   setMayoMNR(mMNR)
      setHistorico(hist.map(normalizeHistorico))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
      <div className="text-center">
        <RefreshCw size={32} className="animate-spin text-blue-400 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Cargando datos HubSpot…</p>
      </div>
    </div>
  )

  const wonMR  = selectedMonth === 'abril' ? abrilMR  : mayoMR
  const wonMNR = selectedMonth === 'abril' ? abrilMNR : mayoMNR
  const totalWonAbril = abrilMR.length + abrilMNR.length
  const totalWonMayo  = mayoMR.length  + mayoMNR.length
  const totalWonKwh = [...wonMR, ...wonMNR].reduce((s, d) => s + parseNum(d['Consumo mensual']), 0)
  const allHistorico = historico

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100">
      {/* HEADER */}
      <header className="border-b border-slate-800 bg-[#0d1120] sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none text-white">Reporte Funnel Comercial · Bia</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">Sales Intelligence · HubSpot Export</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-xs text-slate-500">
              <span>Abr: <span className="text-yellow-400 font-bold">{totalWonAbril}</span> · May: <span className="text-green-400 font-bold">{totalWonMayo}</span> ganados · Histórico: <span className="text-purple-400 font-bold">{historico.length}</span></span>
              <span className="text-slate-700">|</span>
              <span>{pipeline.length} en pipeline · {new Date().toLocaleDateString('es-CO', { dateStyle: 'medium' })}</span>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="max-w-screen-xl mx-auto px-6 pb-3 flex gap-2">
          <TabBtn active={activeTab === 'pipeline'} onClick={() => setActiveTab('pipeline')}>
            <span className="flex items-center gap-2">
              <BarChart3 size={14} /> Pipeline ({pipeline.length})
            </span>
          </TabBtn>
          <TabBtn active={activeTab === 'ganados'} onClick={() => setActiveTab('ganados')}>
            <span className="flex items-center gap-2">
              <Trophy size={14} />
              Ganados
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'ganados' ? 'bg-yellow-500 text-yellow-900' : 'bg-yellow-900/60 text-yellow-400'}`}>
                {wonMR.length + wonMNR.length}
              </span>
            </span>
          </TabBtn>
          <TabBtn active={activeTab === 'kam'} onClick={() => setActiveTab('kam')}>
            <span className="flex items-center gap-2">
              <Users size={14} /> Por KAM
            </span>
          </TabBtn>
          <TabBtn active={activeTab === 'autopista'} onClick={() => setActiveTab('autopista')}>
            <span className="flex items-center gap-2">
              <Route size={14} /> Por Autopista
            </span>
          </TabBtn>
          <TabBtn active={activeTab === 'historico'} onClick={() => setActiveTab('historico')}>
            <span className="flex items-center gap-2">
              <History size={14} /> Histórico
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'historico' ? 'bg-purple-500 text-white' : 'bg-purple-900/60 text-purple-400'}`}>
                {allHistorico.length}
              </span>
            </span>
          </TabBtn>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8">
        {activeTab !== 'pipeline' && activeTab !== 'historico' && (
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs text-slate-500 font-medium">Ver mes:</span>
            <MonthSelector selected={selectedMonth} onChange={setSelectedMonth} />
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-slate-500">
              {wonMR.length + wonMNR.length} ganados · {fmtKwh(totalWonKwh)}
            </span>
          </div>
        )}
        {activeTab === 'pipeline'  && <PipelineView data={pipeline} />}
        {activeTab === 'ganados'   && <WonTable mrData={wonMR} mnrData={wonMNR} />}
        {activeTab === 'kam'       && <KamView mrData={wonMR} mnrData={wonMNR} />}
        {activeTab === 'autopista' && <AutopistaView mrData={wonMR} mnrData={wonMNR} />}
        {activeTab === 'historico' && <HistoricoView allData={allHistorico} />}
      </main>

      <footer className="border-t border-slate-800 mt-12 py-4 text-center text-xs text-slate-600">
        Bia Sales Intelligence · Datos HubSpot · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
