import { SmartChipService } from '../services/smart-chip.service';

describe('SmartChipService', () => {
  it('should suggest meal chips for dinner related notes', () => {
    const note = "We had a lovely dinner at the new italian place.";
    const suggestions = SmartChipService.suggestChipsFromNote(note);

    expect(suggestions.length).toBeGreaterThan(0);
    const ids = suggestions.map(s => s.id);
    expect(ids.some(id => id.includes('meal') || id.includes('dinner'))).toBe(true);
  });
});
