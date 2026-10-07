import { RecipeEditor } from '@/components/Recipes';

export default async function NewRecipePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return <RecipeEditor key={from} copyOf={from} />;
}
