import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { FormBuilder } from '@angular/forms';

import { Chip } from 'src/app/services/interfaces/chip';
import { SiteTheme } from 'src/app/services/interfaces/site-theme';
import { Youtuber } from 'src/app/services/interfaces/youtuber';
import { AdmComponent } from './adm.component';

describe('AdmComponent ordering', () => {
  let component: AdmComponent;
  let firebase: {
    atualizarOrdemChips: jasmine.Spy;
    atualizarOrdemYoutubers: jasmine.Spy;
    atualizarOrdemTemas: jasmine.Spy;
    atualizarTema: jasmine.Spy;
    cadastrarTema: jasmine.Spy;
  };
  let toastService: {
    success: jasmine.Spy;
    error: jasmine.Spy;
  };

  beforeEach(() => {
    firebase = {
      atualizarOrdemChips: jasmine.createSpy().and.resolveTo(),
      atualizarOrdemYoutubers: jasmine.createSpy().and.resolveTo(),
      atualizarOrdemTemas: jasmine.createSpy().and.resolveTo(),
      atualizarTema: jasmine.createSpy().and.resolveTo(),
      cadastrarTema: jasmine.createSpy().and.resolveTo({ id: 'new-theme' })
    };
    toastService = {
      success: jasmine.createSpy(),
      error: jasmine.createSpy()
    };

    component = new AdmComponent(
      {} as any,
      firebase as any,
      new FormBuilder(),
      toastService as any,
      {} as any,
      {} as any,
      {} as any
    );
  });

  it('sorts radios by title and persists a sequential order', async () => {
    component.chipArray = [
      createChip('radio-z', 'video-z', 1, 'Zulu'),
      createChip('radio-a', 'video-a', 2, 'Ambient'),
      createChip('radio-c', 'video-c', 3, 'Cafe')
    ];

    await component.sortChipsAlphabetically();

    expect(component.chipArray.map(chip => chip.id)).toEqual(['radio-a', 'radio-c', 'radio-z']);
    expect(component.chipArray.map(chip => chip.order)).toEqual([1, 2, 3]);
    expect(firebase.atualizarOrdemChips).toHaveBeenCalledWith(['radio-a', 'radio-c', 'radio-z']);
  });

  it('sorts youtubers by title and persists the result', async () => {
    component.youtuberArray = [
      createYoutuber('youtube-z', 'Zulu', 1),
      createYoutuber('youtube-a', 'Ambient', 2),
      createYoutuber('youtube-c', 'Cafe', 3)
    ];

    await component.sortYoutubersAlphabetically();

    expect(component.youtuberArray.map(youtuber => youtuber.id)).toEqual([
      'youtube-a',
      'youtube-c',
      'youtube-z'
    ]);
    expect(firebase.atualizarOrdemYoutubers).toHaveBeenCalledWith([
      'youtube-a',
      'youtube-c',
      'youtube-z'
    ]);
  });

  it('persists a youtuber drag and drop', async () => {
    component.youtuberArray = [
      createYoutuber('youtube-a', 'Ambient', 1),
      createYoutuber('youtube-c', 'Cafe', 2),
      createYoutuber('youtube-z', 'Zulu', 3)
    ];

    await component.onYoutuberDrop({
      previousIndex: 0,
      currentIndex: 2
    } as CdkDragDrop<Youtuber[]>);

    expect(component.youtuberArray.map(youtuber => youtuber.id)).toEqual([
      'youtube-c',
      'youtube-z',
      'youtube-a'
    ]);
    expect(firebase.atualizarOrdemYoutubers).toHaveBeenCalledWith([
      'youtube-c',
      'youtube-z',
      'youtube-a'
    ]);
  });

  it('restores the previous youtuber order when persistence fails', async () => {
    component.youtuberArray = [
      createYoutuber('youtube-a', 'Ambient', 1),
      createYoutuber('youtube-c', 'Cafe', 2),
      createYoutuber('youtube-z', 'Zulu', 3)
    ];
    firebase.atualizarOrdemYoutubers.and.returnValue(Promise.reject(new Error('offline')));

    await component.onYoutuberDrop({
      previousIndex: 0,
      currentIndex: 2
    } as CdkDragDrop<Youtuber[]>);

    expect(component.youtuberArray.map(youtuber => youtuber.id)).toEqual([
      'youtube-a',
      'youtube-c',
      'youtube-z'
    ]);
    expect(toastService.error).toHaveBeenCalled();
  });

  it('supports keyboard reordering from the drag handle', async () => {
    component.youtuberArray = [
      createYoutuber('youtube-a', 'Ambient', 1),
      createYoutuber('youtube-c', 'Cafe', 2),
      createYoutuber('youtube-z', 'Zulu', 3)
    ];
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });

    await component.onYoutuberHandleKeydown(event, 0);

    expect(event.defaultPrevented).toBeTrue();
    expect(component.youtuberArray.map(youtuber => youtuber.id)).toEqual([
      'youtube-c',
      'youtube-a',
      'youtube-z'
    ]);
  });

  it('persists theme drag and drop with contiguous positions', async () => {
    component.themeArray = [
      createTheme('purple', 'Roxo', 1),
      createTheme('blue', 'Azul', 2),
      createTheme('green', 'Verde', 3)
    ];

    await component.onThemeDrop({
      previousIndex: 2,
      currentIndex: 0
    } as CdkDragDrop<SiteTheme[]>);

    expect(component.themeArray.map(theme => theme.id)).toEqual(['green', 'purple', 'blue']);
    expect(component.themeArray.map(theme => theme.order)).toEqual([1, 2, 3]);
    expect(firebase.atualizarOrdemTemas).toHaveBeenCalledOnceWith(['green', 'purple', 'blue']);
  });

  it('restores the previous theme order when persistence fails', async () => {
    component.themeArray = [
      createTheme('purple', 'Roxo', 1),
      createTheme('blue', 'Azul', 2)
    ];
    firebase.atualizarOrdemTemas.and.returnValue(Promise.reject(new Error('offline')));

    await component.onThemeDrop({
      previousIndex: 0,
      currentIndex: 1
    } as CdkDragDrop<SiteTheme[]>);

    expect(component.themeArray.map(theme => theme.id)).toEqual(['purple', 'blue']);
    expect(component.themeArray.map(theme => theme.order)).toEqual([1, 2]);
    expect(toastService.error).toHaveBeenCalled();
  });

  it('filters themes by manual order or alphabetically without overwriting Firestore', () => {
    component.themeArray = [
      createTheme('purple', 'Roxo', 1),
      createTheme('green', 'Verde', 2),
      createTheme('blue', 'Azul', 3)
    ];

    component.setThemeSortMode('alphabetical');

    expect(component.themeArray.map(theme => theme.id)).toEqual(['blue', 'purple', 'green']);
    expect(firebase.atualizarOrdemTemas).not.toHaveBeenCalled();

    component.setThemeSortMode('order');

    expect(component.themeArray.map(theme => theme.id)).toEqual(['purple', 'green', 'blue']);
    expect(firebase.atualizarOrdemTemas).not.toHaveBeenCalled();
  });

  it('loads a theme into the editor and normalizes short hexadecimal colors', () => {
    (component as any).initForms();
    const theme = createTheme('purple', 'Roxo', 1);

    component.editTheme(theme);
    component.themeCreate.get('primary')?.setValue('abc');
    component.normalizeThemeColor('primary');

    expect(component.editingThemeId).toBe('purple');
    expect(component.themeCreate.get('name')?.value).toBe('Roxo');
    expect(component.themeCreate.get('primary')?.value).toBe('#AABBCC');
  });

  it('persists edits without changing the theme identity or order', () => {
    (component as any).initForms();
    const theme = createTheme('purple', 'Roxo', 3);
    component.themeArray = [theme];
    component.editingThemeId = theme.id;
    component.themeCreate.setValue({
      name: 'Roxo noturno',
      background: '#101010',
      primary: '#ABCDEF',
      secondary: '#202020',
      accent: '#303030',
      accentLight: '#404040',
      text: '#F0F0F0'
    });

    component.themeCreateForm();

    expect(firebase.atualizarTema).toHaveBeenCalledOnceWith('purple', {
      name: 'Roxo noturno',
      colors: {
        background: '#101010',
        primary: '#ABCDEF',
        secondary: '#202020',
        accent: '#303030',
        accentLight: '#404040',
        text: '#F0F0F0'
      },
      swatch: '#ABCDEF'
    });
    expect(firebase.cadastrarTema).not.toHaveBeenCalled();
  });

  it('fills missing positions without discarding persisted positions', () => {
    const items = [
      { id: 'legacy', title: 'Beta' },
      { id: 'third', title: 'Zulu', order: 3 },
      { id: 'first', title: 'Alpha', order: 1 }
    ];

    const sorted = (component as any).sortByStoredOrder(
      items,
      (item: { title: string }) => item.title
    );

    expect(sorted.map((item: { id: string }) => item.id)).toEqual(['first', 'legacy', 'third']);
  });

  function createChip(id: string, videoId: string, order: number, title: string): Chip {
    const chip = new Chip(id, videoId, order);
    chip.title = title;
    return chip;
  }

  function createYoutuber(id: string, title: string, order: number): Youtuber {
    return {
      id,
      channelId: `channel-${id}`,
      title,
      order
    };
  }

  function createTheme(id: string, name: string, order: number): SiteTheme {
    return {
      id,
      name,
      order,
      swatch: '#AEA4D3',
      colors: {
        background: '#1F1E30',
        primary: '#AEA4D3',
        secondary: '#4B3470',
        accent: '#805CB1',
        accentLight: '#707CB5',
        text: '#EFF1E4'
      }
    };
  }
});
