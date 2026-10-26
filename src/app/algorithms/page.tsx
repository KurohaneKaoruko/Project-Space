import Navigation from '../components/Navigation';
import CategoryPage from '../components/CategoryPage';
import StaggerCleanup from '../components/StaggerCleanup';
import { algorithms } from '../data/projects';

export default function AlgorithmsPage() {
  return (
    <>
      <Navigation />
      <StaggerCleanup />
      <CategoryPage
        no="04"
        title="ALL_ALGORITHMS"
        subtitle="CLASSIC_ALGORITHM_VISUALIZATIONS_LIST"
        projects={algorithms}
        basePath="/algorithms"
      />
    </>
  );
}
