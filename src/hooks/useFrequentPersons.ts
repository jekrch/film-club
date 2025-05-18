import { useState, useEffect } from 'react';
import { getAllFilmCreditsForPerson, PersonCredit } from '../utils/filmUtils'; // Ensure this util is correct
import { Film } from '../types/film';

export interface FrequentPersonDataHook extends PersonCredit { // Re-using PersonCredit for individual film entries
    name: string; // Person's name
    count: number; // How many films they are credited in
    filmography: PersonCredit[]
}

export interface CreditsModalInfoHook { // Renamed to avoid conflict if used elsewhere
    isOpen: boolean;
    personName: string | null;
    filmography: PersonCredit[] | null; // This matches what getAllFilmCreditsForPerson returns
}

export interface UseFrequentPersonsReturn {
    frequentPersons: FrequentPersonDataHook[];
    creditsModalState: CreditsModalInfoHook;
    handleFrequentPersonClick: (personName: string, filmography: PersonCredit[]) => void;
    closeCreditsModal: () => void;
}

export const useFrequentPersons = (
    films: Film[],
    topN: number = 6
): UseFrequentPersonsReturn => {
    const [frequentPersons, setFrequentPersons] = useState<FrequentPersonDataHook[]>([]);
    const [creditsModalState, setCreditsModalState] = useState<CreditsModalInfoHook>({
        isOpen: false,
        personName: null,
        filmography: null,
    });

    useEffect(() => {
        if (!films.length) {
            setFrequentPersons([]);
            return;
        }

        const personCounts: Record<string, { count: number; filmEntries: PersonCredit[] }> = {};
        const creditFields: (keyof Film)[] = [
            'director', 'writer', 'actors', 'cinematographer',
            'editor', 'productionDesigner', 'musicComposer', 'costumeDesigner'
        ];

        films.forEach(film => {
            const personsInThisFilm = new Set<string>();
            creditFields.forEach(field => {
                const creditString = film[field] as string | undefined;
                if (creditString && typeof creditString === 'string' && creditString.toLowerCase() !== "n/a") {
                    creditString.split(',').map(name => name.trim()).filter(name => name).forEach(name => {
                        personsInThisFilm.add(name);
                    });
                }
            });

            personsInThisFilm.forEach(personName => {
                if (!personCounts[personName]) {
                    // Initialize with all film credits for this person across the entire dataset
                    personCounts[personName] = { count: 0, filmEntries: getAllFilmCreditsForPerson(personName, films) };
                }
                personCounts[personName].count++; // Increment count for each film they appear in
            });
        });

        const sortedPersons = Object.entries(personCounts)
            .map(([name, data]) => ({
                name,
                count: data.count,
                // The 'film' and 'roles' for the top-level FrequentPersonDataHook might be a bit redundant here
                // as filmography will contain the detailed list. Let's stick to the AlmanacPage structure.
                // For the top-level display, we just need name and count, and the full filmography for the modal.
                film: {} as Film, // Placeholder, not really used at this top level
                roles: [],       // Placeholder
                filmography: data.filmEntries // This is the important part for the modal
            }))
            .filter(p => p.count > 1) // Only include persons appearing in more than one film
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
            .slice(0, topN);

        setFrequentPersons(sortedPersons as FrequentPersonDataHook[]);

    }, [films, topN]);

    const handleFrequentPersonClick = (personName: string, filmography: PersonCredit[]) => {
        setCreditsModalState({
            isOpen: true,
            personName: personName,
            filmography: filmography,
        });
    };

    const closeCreditsModal = () => {
        setCreditsModalState({ isOpen: false, personName: null, filmography: null });
    };

    return {
        frequentPersons,
        creditsModalState,
        handleFrequentPersonClick,
        closeCreditsModal,
    };
};