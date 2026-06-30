import { Character } from './types';

// Label used for the section holding characters that belong to no group.
export const UNGROUPED_LABEL = 'Ungrouped';

export interface CharacterGroupSection {
  name: string; // group name, or UNGROUPED_LABEL for the ungrouped section
  isUngrouped: boolean;
  characters: Character[];
}

// Trim a group value to a canonical form; empty string means "no group".
export function normalizeGroup(group?: string): string {
  return (group || '').trim();
}

// Distinct, alphabetically sorted list of group names present on the characters.
export function listGroups(characters: Character[]): string[] {
  const set = new Set<string>();
  for (const character of characters) {
    const group = normalizeGroup(character.group);
    if (group) set.add(group);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Split characters into ordered sections: named groups (alphabetical) first,
// then a single ungrouped section last (only when ungrouped characters exist).
// Order within each section is preserved from the input array.
export function groupCharacters(characters: Character[]): CharacterGroupSection[] {
  const sections: CharacterGroupSection[] = listGroups(characters).map(name => ({
    name,
    isUngrouped: false,
    characters: characters.filter(c => normalizeGroup(c.group) === name),
  }));

  const ungrouped = characters.filter(c => !normalizeGroup(c.group));
  if (ungrouped.length > 0) {
    sections.push({ name: UNGROUPED_LABEL, isUngrouped: true, characters: ungrouped });
  }

  return sections;
}
