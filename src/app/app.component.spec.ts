import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { Link, LinksService } from './links.service';

describe('AppComponent', () => {
  let linksService: jasmine.SpyObj<LinksService>;

  beforeEach(async () => {
    linksService = jasmine.createSpyObj<LinksService>('LinksService', ['create', 'list']);
    linksService.list.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: LinksService, useValue: linksService }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should reject non-http URLs without making an API request', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.form.setValue('ftp://example.com/file');

    app.submit();

    expect(app.form.touched).toBeTrue();
    expect(linksService.create).not.toHaveBeenCalled();
  });

  it('should add the created link to the table and reset the form', () => {
    const link: Link = {
      code: 'a1B2c3',
      url: 'https://example.com/',
      shortUrl: 'http://localhost:3000/a1B2c3',
      hits: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    linksService.create.and.returnValue(of(link));
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    app.form.setValue('https://example.com');

    app.submit();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(app.form.value).toBe('');
    expect(app.links()).toEqual([link]);
    expect(compiled.querySelector('tbody')?.textContent).toContain('a1B2c3');
  });

  it('should show API errors inline', () => {
    linksService.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { error: 'Invalid URL.' } })),
    );
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    app.form.setValue('https://example.com');

    app.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Invalid URL.');
  });
});
