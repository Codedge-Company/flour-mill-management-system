import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MachineOperatorComponent } from './machine-operator.component';

describe('MachineOperatorComponent', () => {
  let component: MachineOperatorComponent;
  let fixture: ComponentFixture<MachineOperatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MachineOperatorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MachineOperatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
