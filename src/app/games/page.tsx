import Navigation from '../components/Navigation';
import CategoryPage from '../components/CategoryPage';
import StaggerCleanup from '../components/StaggerCleanup';
import { games } from '../data/projects';

export default function GamesPage() {
  return (
    <>
      <Navigation />
      <StaggerCleanup />
      <CategoryPage
        no="01"
        title="ALL_GAMES"
        subtitle="INTERACTIVE_ENTERTAINMENT_MODULES_LIST"
        projects={games}
        basePath="/games"
      />
    </>
  );
}
