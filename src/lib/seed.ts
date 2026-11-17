import type { StudySet } from './types'
import { uid } from './util'

function makeSet(title: string, description: string, rows: [string, string][]): StudySet {
  const now = Date.now()
  return {
    id: uid(),
    title,
    description,
    createdAt: now,
    updatedAt: now,
    cards: rows.map(([term, definition]) => ({ id: uid(), term, definition })),
  }
}

export function sampleSets(): StudySet[] {
  return [
    makeSet('Spanish: Everyday Verbs', 'Common Spanish verbs and their English meanings.', [
      ['hablar', 'to speak'],
      ['comer', 'to eat'],
      ['vivir', 'to live'],
      ['tener', 'to have'],
      ['ser', 'to be (permanent)'],
      ['estar', 'to be (temporary)'],
      ['ir', 'to go'],
      ['hacer', 'to do / to make'],
      ['poder', 'to be able to'],
      ['querer', 'to want'],
      ['saber', 'to know (facts)'],
      ['conocer', 'to know (people/places)'],
    ]),
    makeSet('Cell Biology Basics', 'Organelles and their functions.', [
      ['Nucleus', 'Contains the cell’s genetic material and controls cell activities'],
      ['Mitochondria', 'Produces ATP through cellular respiration'],
      ['Ribosome', 'Site of protein synthesis'],
      ['Golgi apparatus', 'Modifies, sorts, and packages proteins for transport'],
      ['Endoplasmic reticulum', 'Network of membranes that transports materials; rough ER has ribosomes'],
      ['Lysosome', 'Contains digestive enzymes that break down waste'],
      ['Cell membrane', 'Selectively permeable barrier that controls what enters and leaves the cell'],
      ['Chloroplast', 'Site of photosynthesis in plant cells'],
      ['Vacuole', 'Stores water, nutrients, and waste'],
    ]),
  ]
}
