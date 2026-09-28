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

interface CategoryIconProps {
  category: Category;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 'md', className = '' }) => {
  const getIconElement = (iconName: string, iconSizeClass: string) => {
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

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-12 h-12 rounded-2xl',
    lg: 'w-14 h-14 rounded-3xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4 text-white',
    md: 'w-6 h-6 text-white',
    lg: 'w-7 h-7 text-white',
  };

  return (
    <div
      className={`flex items-center justify-center shadow-sm shrink-0 transition-transform duration-200 group-hover:scale-105 ${sizeClasses[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, ${category.color} 0%, ${category.color}CC 100%)`,
        boxShadow: `0 6px 16px -2px ${category.color}35`,
      }}
    >
      {getIconElement(category.icon, iconSizes[size])}
    </div>
  );
};
