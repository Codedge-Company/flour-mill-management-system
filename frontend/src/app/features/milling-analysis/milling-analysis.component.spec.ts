import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MillingAnalysisComponent } from './milling-analysis.component';

describe('MillingAnalysisComponent', () => {
  let component: MillingAnalysisComponent;
  let fixture: ComponentFixture<MillingAnalysisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MillingAnalysisComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MillingAnalysisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
