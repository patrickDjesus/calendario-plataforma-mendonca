import React from 'react';
import { 
  BookOpen, 
  Calculator, 
  Atom, 
  Briefcase, 
  User, 
  HeartPulse, 
  Tag, 
  Code, 
  GraduationCap, 
  Palette, 
  Music, 
  Globe 
} from 'lucide-react';
import { Category } from '../types';
import { GifIcon, GifName } from './GifIcon';

/** Categories that ship with a dedicated animated illustration. */
const CATEGORY_GIF: Record<string, GifName> = {
  book: 'tarefa-estudo',
  estudo: 'tarefa-estudo',
  'graduation-cap': 'tarefa-estudo',
  briefcase: 'tarefa-trabalho',
  trabalho: 'tarefa-trabalho',
  'heart-pulse': 'tarefa-saude',
  saude: 'tarefa-saude',
};

interface CategoryIconProps {
  category: Category;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 'md', className = '' }) => {
  const getIconElement = (iconName: string, iconSizeClass: string) => {
    const gif = CATEGORY_GIF[iconName.toLowerCase()];
    if (gif) {
      return <GifIcon name={gif} className="w-full h-full" />;
    }

    switch (iconName.toLowerCase()) {
      case 'book':
      case 'estudo':
        return <BookOpen className={iconSizeClass} />;
      case 'calculator':
      case 'matematica':
        return <Calculator className={iconSizeClass} />;
      case 'atom':
      case 'fisica':
      case 'ciencia':
        return <Atom className={iconSizeClass} />;
      case 'briefcase':
      case 'trabalho':
        return <Briefcase className={iconSizeClass} />;
      case 'user':
      case 'pessoal':
        return <User className={iconSizeClass} />;
      case 'heart-pulse':
      case 'saude':
        return <HeartPulse className={iconSizeClass} />;
      case 'code':
        return <Code className={iconSizeClass} />;
      case 'graduation-cap':
        return <GraduationCap className={iconSizeClass} />;
      case 'palette':
        return <Palette className={iconSizeClass} />;
      case 'music':
        return <Music className={iconSizeClass} />;
      case 'globe':
        return <Globe className={iconSizeClass} />;
      default:
        return <Tag className={iconSizeClass} />;
    }
  };

  // So a ilustracao. Sem tile, sem gradiente, sem sombra: a cor da materia
  // fica apenas no texto/label que acompanha o icone.
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div
      className={`flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${sizeClasses[size]} ${className}`}
      style={{ color: category.color }}
    >
      {getIconElement(category.icon, iconSizes[size])}
    </div>
  );
};
