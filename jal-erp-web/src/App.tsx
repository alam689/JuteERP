import { Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { HomeRedirect, RequireAuth, RequirePermission } from './auth/guards';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProcessFlow from './pages/production/ProcessFlow';
import Orders from './pages/production/Orders';
import OrderDetail from './pages/production/OrderDetail';
import ShiftEntryPage from './pages/production/ShiftEntry';
import DailyBoard from './pages/production/DailyBoard';
import Items from './pages/engineering/Items';
import Routings from './pages/engineering/Routings';
import Mrp from './pages/planning/Mrp';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<HomeRedirect />} />
        <Route path="dashboard" element={<RequirePermission perm="dashboard.view"><Dashboard /></RequirePermission>} />
        <Route path="production" element={<RequirePermission perm="production.view"><ProcessFlow /></RequirePermission>} />
        <Route path="production/orders" element={<RequirePermission perm="production.view"><Orders /></RequirePermission>} />
        <Route path="production/orders/:id" element={<RequirePermission perm="production.view"><OrderDetail /></RequirePermission>} />
        <Route path="production/shift-entry" element={<RequirePermission perm="production.entry.create"><ShiftEntryPage /></RequirePermission>} />
        <Route path="production/board" element={<RequirePermission perm="production.view"><DailyBoard /></RequirePermission>} />
        <Route path="engineering/items" element={<RequirePermission perm="production.view"><Items /></RequirePermission>} />
        <Route path="engineering/routings" element={<RequirePermission perm="production.view"><Routings /></RequirePermission>} />
        <Route path="planning/mrp" element={<RequirePermission perm="production.view"><Mrp /></RequirePermission>} />
        <Route
          path="*"
          element={
            <div className="empty-state">
              <h2>Page not found</h2>
              <p><Link to="/">Go to home</Link></p>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
