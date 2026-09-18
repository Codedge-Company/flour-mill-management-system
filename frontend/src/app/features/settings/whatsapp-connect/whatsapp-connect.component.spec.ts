import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WhatsappConnectComponent } from './whatsapp-connect.component';

describe('WhatsappConnectComponent', () => {
  let component: WhatsappConnectComponent;
  let fixture: ComponentFixture<WhatsappConnectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhatsappConnectComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WhatsappConnectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
