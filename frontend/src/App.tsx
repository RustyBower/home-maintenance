import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Home, List, Plus, Calendar, DollarSign, Package, Wrench, Settings, Box, Users, AlertCircle, Bell, FileText, Download } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import TaskList from "./pages/TaskList";
import TaskDetail from "./pages/TaskDetail";
import AddTask from "./pages/AddTask";
import WeekendPlanner from "./pages/WeekendPlanner";
import Timeline from "./pages/Timeline";
import Costs from "./pages/Costs";
import Supplies from "./pages/Supplies";
import Assets from "./pages/Assets";
import AssetDetail from "./pages/AssetDetail";
import Contractors from "./pages/Contractors";
import ContractorDetail from "./pages/ContractorDetail";
import Repairs from "./pages/Repairs";
import RepairDetail from "./pages/RepairDetail";
import Setup from "./pages/Setup";
import Documents from "./pages/Documents";
import Notifications from "./pages/Notifications";
import ExportImport from "./pages/ExportImport";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="sidebar">
          <div className="logo">
            <img src="/favicon.svg" alt="" width="28" height="28" />
            <h2>Home Maint.</h2>
          </div>
          <NavLink to="/" end>
            <Home size={18} /> Dashboard
          </NavLink>
          <NavLink to="/tasks">
            <List size={18} /> All Tasks
          </NavLink>
          <NavLink to="/weekend">
            <Wrench size={18} /> Weekend Plan
          </NavLink>
          <NavLink to="/timeline">
            <Calendar size={18} /> Timeline
          </NavLink>
          <NavLink to="/costs">
            <DollarSign size={18} /> Costs
          </NavLink>
          <NavLink to="/assets">
            <Box size={18} /> Assets
          </NavLink>
          <NavLink to="/contractors">
            <Users size={18} /> Contractors
          </NavLink>
          <NavLink to="/repairs">
            <AlertCircle size={18} /> Repairs
          </NavLink>
          <NavLink to="/supplies">
            <Package size={18} /> Supplies
          </NavLink>
          <NavLink to="/documents">
            <FileText size={18} /> Documents
          </NavLink>
          <NavLink to="/notifications">
            <Bell size={18} /> Notifications
          </NavLink>
          <NavLink to="/export">
            <Download size={18} /> Export
          </NavLink>
          <NavLink to="/tasks/new">
            <Plus size={18} /> Add Task
          </NavLink>
          <NavLink to="/setup">
            <Settings size={18} /> Setup
          </NavLink>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<TaskList />} />
            <Route path="/tasks/new" element={<AddTask />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/weekend" element={<WeekendPlanner />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/assets/:id" element={<AssetDetail />} />
            <Route path="/contractors" element={<Contractors />} />
            <Route path="/contractors/:id" element={<ContractorDetail />} />
            <Route path="/repairs" element={<Repairs />} />
            <Route path="/repairs/:id" element={<RepairDetail />} />
            <Route path="/supplies" element={<Supplies />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/export" element={<ExportImport />} />
            <Route path="/setup" element={<Setup />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
