// MADDY Letter Quest: letters must be collected strictly in order. The two Ds are separate indexed pickups
// (index 2 and index 3), so collecting "a D" never satisfies both.

export const WORD = ['M', 'A', 'D', 'D', 'Y'] as const;

export class LetterQuest {
  /** Index of the next letter needed in the current word (0..4). */
  next = 0;
  /** Completed words this run. */
  words = 0;
  /** Per-slot collected flags for the current word (for the HUD). */
  slots: boolean[] = [false, false, false, false, false];
  /** Sequence ids of words already rewarded (stable, so a word pays out exactly once). */
  private rewarded = new Set<number>();

  reset() {
    this.next = 0;
    this.words = 0;
    this.slots = [false, false, false, false, false];
    this.rewarded.clear();
  }

  /**
   * Offer a letter pickup with its index. Returns 'ignored' if it is not the next letter,
   * 'letter' when accepted, or 'word' when it completes MADDY (reward once per sequence).
   */
  collect(index: number): 'ignored' | 'letter' | 'word' {
    if (index !== this.next) return 'ignored';
    this.slots[index] = true;
    this.next++;
    if (this.next >= WORD.length) {
      const seq = this.words;
      this.words++;
      this.next = 0;
      this.slots = [false, false, false, false, false];
      if (!this.rewarded.has(seq)) {
        this.rewarded.add(seq);
        return 'word';
      }
      return 'letter';
    }
    return 'letter';
  }

  get progress(): number {
    return this.next;
  }
}
