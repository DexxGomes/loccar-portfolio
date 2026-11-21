import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Layout from './components/Layout.jsx';
import Hoje from './pages/Hoje.jsx';
import Painel from './pages/Painel.jsx';
import Dinheiro from './pages/Dinheiro.jsx';
import Agenda from './pages/Agenda.jsx';
import Timeline from './pages/Timeline.jsx';
import Financeiro from './pages/Financeiro.jsx';
import Frota from './pages/Frota.jsx';
import Analise from './pages/Analise.jsx';
import Conversas from './pages/Conversas.jsx';
import Blocklist from './pages/Blocklist.jsx';
import Leads from './pages/Leads.jsx';
import Relatorio from './pages/Relatorio.jsx';
import Contrato from './pages/Contrato.jsx';
import Config from './pages/Config.jsx';
import Clientes from './pages/Clientes.jsx';
import Multas from './pages/Multas.jsx';
import Despesas from './pages/Despesas.jsx';

function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        {/* "Hoje" é a primeira tela depois do login: o que precisa de você. */}
        <Route index element={<Navigate to="/hoje" replace />} />
        <Route path="hoje" element={<Hoje />} />
        <Route path="painel" element={<Painel />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="dinheiro" element={<Dinheiro />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="frota" element={<Frota />} />
        <Route path="leads" element={<Leads />} />
        <Route path="relatorio" element={<Relatorio />} />
        <Route path="analise" element={<Analise />} />
        <Route path="conversas" element={<Conversas />} />
        <Route path="blocklist" element={<Blocklist />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="multas" element={<Multas />} />
        <Route path="despesas" element={<Despesas />} />
        <Route path="contrato/:id" element={<Contrato />} />
        <Route path="configuracoes" element={<Config />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
