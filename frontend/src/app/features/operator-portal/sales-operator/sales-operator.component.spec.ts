import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesOperatorComponent } from './sales-operator.component';

describe('SalesOperatorComponent', () => {
  let component: SalesOperatorComponent;
  let fixture: ComponentFixture<SalesOperatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalesOperatorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SalesOperatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
