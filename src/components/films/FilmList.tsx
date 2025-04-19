import React from 'react';
import { Film } from '../../types/film'; 
import FilmCard from './FilmCard';

interface FilmListProps {
  films: Film[];
  title?: string;
}

const FilmList: React.FC<FilmListProps> = ({ films, title }) => {
  return (
    <div className="py-8">
      {title && (
        <h2 className="text-2xl font-bold mb-6 text-gray-200">{title}</h2>
      )}

      {films.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">No films found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {/* Use imdbID as the key */}
          {films.map((film) => (
            <FilmCard key={film.imdbID} film={film} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FilmList;