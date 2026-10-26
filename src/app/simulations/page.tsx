import Navigation from '../components/Navigation';
import CategoryPage from '../components/CategoryPage';
import StaggerCleanup from '../components/StaggerCleanup';
import { simulations } from '../data/projects';

export default function SimulationsPage() {
  return (
    <>
      <Navigation />
      <StaggerCleanup />
      <CategoryPage
        no="02"
        title="ALL_SIMULATIONS"
        subtitle="PHYSICS_AND_MATH_EXPERIMENTS_LIST"
        projects={simulations}
        basePath="/simulations"
      />
    </>
  );
}
