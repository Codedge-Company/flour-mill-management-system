import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WhatsAppService, WhatsAppStatus } from '../../../core/services/whatsapp.service';

@Component({
  selector: 'app-whatsapp-connect',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './whatsapp-connect.component.html',
  styleUrl: './whatsapp-connect.component.css'
})
export class WhatsappConnectComponent implements OnInit, OnDestroy {
  qrImage: string | null = null;
  ready = false;
  private sub?: Subscription;

  constructor(private whatsapp: WhatsAppService) {}

  ngOnInit(): void {
    this.sub = this.whatsapp.pollStatus().subscribe((status: WhatsAppStatus) => {
      this.qrImage = status.qrImage;
      this.ready = status.ready;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}