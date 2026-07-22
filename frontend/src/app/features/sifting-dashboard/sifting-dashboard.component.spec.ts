import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SiftingDashboardComponent } from './sifting-dashboard.component';

describe('SiftingDashboardComponent', () => {
  let component: SiftingDashboardComponent;
  let fixture: ComponentFixture<SiftingDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SiftingDashboardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SiftingDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
