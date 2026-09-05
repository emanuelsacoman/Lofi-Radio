import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { FormBuilder } from '@angular/forms';

import { Chip } from 'src/app/services/interfaces/chip';
import { Youtuber } from 'src/app/services/interfaces/youtuber';
import { AdmComponent } from './adm.component';

describe('AdmComponent ordering', () => {
  let component: AdmComponent;
  let firebase: {
    atualizarOrdemChips: jasmine.Spy;
    atualizarOrdemYoutubers: jasmine.Spy;
  };
  let toastService: {
    success: jasmine.Spy;
    error: jasmine.Spy;
  };

  beforeEach(() => {
    firebase = {
      atualizarOrdemChips: jasmine.createSpy().and.resolveTo(),
      atualizarOrdemYoutubers: jasmine.createSpy().and.resolveTo()
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
});
