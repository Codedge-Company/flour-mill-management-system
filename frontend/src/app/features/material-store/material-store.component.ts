import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RawRicePanelComponent } from './raw-rice-panel/raw-rice-panel.component';
import { BagStockPanelComponent } from './bag-stock-panel/bag-stock-panel.component';
import { SparePartsPanelComponent } from './spare-parts-panel/spare-parts-panel.component';

type TabKey = 'raw-rice' | 'bags' | 'spares';

@Component({
  selector: 'app-material-store',
  standalone: true,
  imports: [CommonModule, RawRicePanelComponent, BagStockPanelComponent, SparePartsPanelComponent],
  templateUrl: './material-store.component.html',
  styleUrl: './material-store.component.css',
})
export class MaterialStoreComponent {
  activeTab = signal<TabKey>('raw-rice');

  tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'raw-rice', label: 'Raw Rice Stock', icon: 'pi-inbox' },
    { key: 'bags',     label: 'Bag Stock',      icon: 'pi-box' },
    // { key: 'spares',   label: 'Spare Parts',    icon: 'pi-wrench' },
  ];

  setTab(key: TabKey): void {
    this.activeTab.set(key);
  }
}
