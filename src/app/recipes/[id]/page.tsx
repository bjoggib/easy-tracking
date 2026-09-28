import { RecipeEditor } from '@/components/Recipes';

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecipeEditor key={id} id={id} />;
}
