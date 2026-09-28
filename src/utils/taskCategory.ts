/**
 * Classificacao de tarefa por categoria.
 *
 * "Saúde" não é só a categoria padrão: o usuário pode renomear, criar outra
 * com o mesmo ícone ou trocar o ícone. Por isso a checagem olha três sinais
 * independentes, do mais forte para o mais fraco.
 */

import { Category } from '../types';

export function isHealthCategory(category: Pick<Category, 'id' | 'name' | 'icon'> | null | undefined): boolean {
  if (!category) return false;
  if (category.id === 'cat-saude') return true;
  if (category.icon === 'heart-pulse') return true;

  const name = category.name.toLowerCase();
  return name.includes('saúde') || name.includes('saude') || name.includes('treino');
}

/**
 * Categorias que ganharam ilustração animada propria. Devolve o nome do asset
 * do GifIcon, ou null para as que seguem com o icone vetorial.
 */
export function categoryGifName(
  category: Pick<Category, 'id' | 'name'> | null | undefined
): 'pessoal' | 'outros' | null {
  if (!category) return null;
  if (category.id === 'cat-pessoal') return 'pessoal';
  if (category.id === 'cat-outro') return 'outros';

  const name = category.name.toLowerCase();
  if (name.includes('pessoal')) return 'pessoal';
  if (name.includes('outro')) return 'outros';
  return null;
}
