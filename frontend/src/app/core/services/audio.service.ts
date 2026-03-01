// core/services/audio.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private audio = new Audio('/assets/sounds/stock-update.mp3');

  play(type: string): void {
    const volume = type === 'LOW_STOCK' || type === 'OUT_OF_STOCK' ? 0.8 : 0.5;
    this.audio.volume = volume;
    this.audio.play().catch(() => {});  // Ignore autoplay blocks
  }
}
