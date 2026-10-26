import Navigation from '../components/Navigation';
import CategoryPage from '../components/CategoryPage';
import StaggerCleanup from '../components/StaggerCleanup';
import { tools } from '../data/projects';

export default function ToolsPage() {
  return (
    <>
      <Navigation />
      <StaggerCleanup />
      <CategoryPage
        no="03"
        title="ALL_TOOLS"
        subtitle="UTILITY_AND_PROCESSING_UNITS_LIST"
        projects={tools}
        basePath="/tools"
      />
    </>
  );
}
