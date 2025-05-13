import { Film } from "../types/film";
import { TeamMember } from "../types/team";
import { parseWatchDate } from "./filmUtils";

/**
 * Identify the current selector based on the 'up next' film and active members.
 * If no valid selector is found, fallback to the last watched film's selector.
 * @param upNextFilm 
 * @param sortedActiveMembers 
 * @param determinedSelectorName 
 * @param allFilms 
 * @returns 
 */
export function identifyCurrentSelector(upNextFilm: Film | undefined, sortedActiveMembers: TeamMember[], determinedSelectorName: string | null, allFilms: Film[]) {
    if (upNextFilm?.movieClubInfo?.selector) {
        const potentialSelector = upNextFilm.movieClubInfo.selector;
        // Validate if this selector is actually in the active cycle
        if (sortedActiveMembers.some(m => m.name === potentialSelector)) {
            determinedSelectorName = potentialSelector;
        } else {
            console.warn(`Selector "${potentialSelector}" for upcoming film found in data but not in active team member cycle. Checking fallback.`);
            // determinedSelectorName remains null, fallback will be checked
        }
    }

    // Fallback Logic: If no 'up next' film found OR its selector isn't valid/active
    if (!determinedSelectorName && sortedActiveMembers.length > 0) {
        console.log("Executing fallback logic: No upcoming film found or selector invalid/inactive.");
        // Find all films that *have* been watched
        const watchedFilms = allFilms
            .filter(film => film.movieClubInfo?.watchDate)
            .sort((a, b) => (parseWatchDate(b.movieClubInfo?.watchDate)?.getTime() ?? 0) - (parseWatchDate(a.movieClubInfo?.watchDate)?.getTime() ?? 0)); // Sort descending by date

        if (watchedFilms.length > 0) {
            // Get the most recently watched film
            const mostRecentFilm = watchedFilms[0];
            const lastSelectorName = mostRecentFilm.movieClubInfo?.selector;

            if (lastSelectorName) {
                // Find the index of the last selector in the *active* cycle
                const lastSelectorIndex = sortedActiveMembers.findIndex(m => m.name === lastSelectorName);

                if (lastSelectorIndex !== -1) {
                    // Found the last selector in the active cycle, determine the next one
                    const nextSelectorIndex = (lastSelectorIndex + 1) % sortedActiveMembers.length; // Wrap around using modulo
                    determinedSelectorName = sortedActiveMembers[nextSelectorIndex].name;
                    console.log(`Fallback: Setting next selector based on cycle after ${lastSelectorName}: ${determinedSelectorName}`);
                } else {
                    // Edge Case: Last selector from film data isn't in the current active cycle. Default to the first person.
                    console.warn(`Fallback Warning: Selector "${lastSelectorName}" from most recent film not found in active cycle. Defaulting to the start of the cycle (${sortedActiveMembers[0]?.name}).`);
                    determinedSelectorName = sortedActiveMembers[0].name; // Default to first active member
                }
            } else {
                // Edge Case: Most recent film exists but has no selector defined. Data issue. Default to first active member.
                console.warn(`Fallback Warning: Most recent watched film has no selector defined. Defaulting to the start of the cycle (${sortedActiveMembers[0]?.name}).`);
                determinedSelectorName = sortedActiveMembers[0].name; // Default to first active member
            }
        } else {
            // Edge Case: No films have been watched yet *at all*. Default to the first person in the cycle.
            console.warn(`Fallback Warning: No films with watch dates found. Defaulting selector to the start of the cycle (${sortedActiveMembers[0]?.name}).`);
            determinedSelectorName = sortedActiveMembers[0]?.name; // Default to first active member (add optional chaining just in case)
        }
    } else if (!determinedSelectorName && sortedActiveMembers.length === 0) {
        // Edge case: No active members defined in the cycle
        console.warn("No active members found in the cycle. Cannot determine selector.");
        determinedSelectorName = null;
    }
    return determinedSelectorName;
}
