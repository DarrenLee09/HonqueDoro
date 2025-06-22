import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Statistics } from './statistics';

describe('Statistics', () => {
  let component: Statistics;
  let fixture: ComponentFixture<Statistics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Statistics]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Statistics);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
