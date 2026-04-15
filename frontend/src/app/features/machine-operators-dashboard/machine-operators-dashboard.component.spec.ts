import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MachineOperatorsDashboardComponent } from './machine-operators-dashboard.component';

describe('MachineOperatorsDashboardComponent', () => {
  let component: MachineOperatorsDashboardComponent;
  let fixture: ComponentFixture<MachineOperatorsDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MachineOperatorsDashboardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MachineOperatorsDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
