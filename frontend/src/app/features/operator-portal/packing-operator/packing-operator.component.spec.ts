import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PackingOperatorComponent } from './packing-operator.component';

describe('PackingOperatorComponent', () => {
  let component: PackingOperatorComponent;
  let fixture: ComponentFixture<PackingOperatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PackingOperatorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PackingOperatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
