import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlowMoneyComponent } from './flow-money.component';

describe('FlowMoneyComponent', () => {
  let component: FlowMoneyComponent;
  let fixture: ComponentFixture<FlowMoneyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlowMoneyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FlowMoneyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
