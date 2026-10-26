import Navigation from '../components/Navigation';
import CategoryPage from '../components/CategoryPage';
import StaggerCleanup from '../components/StaggerCleanup';
import { visualizations } from '../data/projects';

export default function VisualizationsPage() {
  return (
    <>
      <Navigation />
      <StaggerCleanup />
      <CategoryPage
        no="05"
        title="ALL_VISUALIZATIONS"
        subtitle="MATH_AND_ALGORITHM_VISUALIZATIONS_LIST"
        projects={visualizations}
        basePath="/visualizations"
      />
    </>
  );
}
