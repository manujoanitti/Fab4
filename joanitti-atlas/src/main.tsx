import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { AtlasProvider } from './lib/api';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { TreePage } from './pages/Tree';
import { PeoplePage } from './pages/People';
import { Profile } from './pages/Profile';
import { MapPage } from './pages/MapPage';
import { TimelinePage } from './pages/Timeline';
import { DocumentsPage } from './pages/Documents';
import { InvestigationsPage } from './pages/Investigations';
import { AdminPage } from './pages/Admin';
import { SearchPage } from './pages/Search';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AtlasProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="arvore" element={<TreePage />} />
            <Route path="pessoas" element={<PeoplePage />} />
            <Route path="pessoas/:id" element={<Profile />} />
            <Route path="mapa" element={<MapPage />} />
            <Route path="linha-do-tempo" element={<TimelinePage />} />
            <Route path="documentos" element={<DocumentsPage />} />
            <Route path="investigacoes" element={<InvestigationsPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="busca" element={<SearchPage />} />
            <Route path="*" element={<div className="p-10 text-center">Página não encontrada.</div>} />
          </Route>
        </Routes>
      </AtlasProvider>
    </BrowserRouter>
  </StrictMode>,
);
