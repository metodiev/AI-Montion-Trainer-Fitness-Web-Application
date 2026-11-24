import { Navigate, Route, Routes } from 'react-router-dom';
import { AppErrorBoundary } from './components/layout/AppErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { ExerciseDetailPage } from './pages/ExerciseDetailPage';
import { AdventurePage } from './pages/AdventurePage';
import { PlannerPage } from './pages/PlannerPage';
import { ProgressPage } from './pages/ProgressPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { SettingsPage } from './pages/SettingsPage';
import { WorkoutPage } from './pages/WorkoutPage';

export default function App() {
  return (
    <AppErrorBoundary>
      <Routes>
      <Route path="/train/:mode" element={<WorkoutPage />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />
        <Route path="/adventure" element={<AdventurePage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      </Routes>
    </AppErrorBoundary>
  );
}
