import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/services/auth.service';
import { FirebaseService } from 'src/app/services/firebase.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';
import { YouTubeVideoDetails, YoutubeService } from 'src/app/services/youtube.service';
import { Chip } from 'src/app/services/interfaces/chip';
import { Youtuber } from 'src/app/services/interfaces/youtuber';

@Component({
  selector: 'app-adm',
  templateUrl: './adm.component.html',
  styleUrls: ['./adm.component.css']
})
export class AdmComponent implements OnInit, OnDestroy {
  chipCreate!: FormGroup;
  youtuberCreate!: FormGroup;

  public chipArray: Chip[] = [];
  public youtuberArray: Youtuber[] = [];

  connectedUsersCount = 0;
  quotaStatus = '';
  isAddingChip = false;
  isAddingYoutuber = false;
  isSyncingLives = false;
  isCleaningLives = false;
  isSavingChipOrder = false;
  isSavingYoutuberOrder = false;

  private subscriptions = new Subscription();
  private readonly titleCollator = new Intl.Collator('pt-BR', {
    sensitivity: 'base',
    numeric: true
  });

  constructor(
    private router: Router,
    private firebase: FirebaseService,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private auth: AuthService,
    private userService: UserService,
    private youtubeService: YoutubeService
  ) {}

  ngOnInit() {
    this.initForms();
    this.loadChips();
    this.loadYoutubers();
    this.fetchConnectedUsersCount();
    this.ytStatus();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  get quotaLabel(): string {
    if (!this.quotaStatus || this.quotaStatus === 'Quota status not available') {
      return 'Sem alerta';
    }

    return this.quotaStatus;
  }

  get isChipSortDisabled(): boolean {
    return this.isSavingChipOrder ||
      !this.chipArray.length ||
      this.chipArray.some(chip => !chip.title);
  }

  trackByChipId(_: number, chip: Chip): string {
    return chip.id;
  }

  trackByYoutuberId(_: number, youtuber: Youtuber): string {
    return youtuber.id;
  }

  async onDrop(event: CdkDragDrop<Chip[]>) {
    if (event.previousIndex === event.currentIndex || this.isSavingChipOrder) {
      return;
    }

    const previousOrder = this.chipArray.map(chip => chip.id);
    moveItemInArray(this.chipArray, event.previousIndex, event.currentIndex);
    await this.saveChipOrder(previousOrder);
  }

  async onYoutuberDrop(event: CdkDragDrop<Youtuber[]>) {
    if (event.previousIndex === event.currentIndex || this.isSavingYoutuberOrder) {
      return;
    }

    const previousOrder = this.youtuberArray.map(youtuber => youtuber.id);
    moveItemInArray(this.youtuberArray, event.previousIndex, event.currentIndex);
    await this.saveYoutuberOrder(previousOrder);
  }

  async onChipHandleKeydown(event: KeyboardEvent, index: number) {
    const targetIndex = this.getKeyboardMoveIndex(event.key, index, this.chipArray.length);

    if (targetIndex === index || this.isSavingChipOrder) {
      return;
    }

    event.preventDefault();
    const previousOrder = this.chipArray.map(chip => chip.id);
    moveItemInArray(this.chipArray, index, targetIndex);
    await this.saveChipOrder(previousOrder);
  }

  async onYoutuberHandleKeydown(event: KeyboardEvent, index: number) {
    const targetIndex = this.getKeyboardMoveIndex(event.key, index, this.youtuberArray.length);

    if (targetIndex === index || this.isSavingYoutuberOrder) {
      return;
    }

    event.preventDefault();
    const previousOrder = this.youtuberArray.map(youtuber => youtuber.id);
    moveItemInArray(this.youtuberArray, index, targetIndex);
    await this.saveYoutuberOrder(previousOrder);
  }

  async sortChipsAlphabetically() {
    if (this.isChipSortDisabled) {
      return;
    }

    const previousOrder = this.chipArray.map(chip => chip.id);
    this.chipArray = [...this.chipArray].sort((a, b) =>
      this.compareLabels(this.getChipSortLabel(a), this.getChipSortLabel(b)) ||
      this.compareLabels(a.chipname, b.chipname)
    );

    await this.saveChipOrder(previousOrder, 'Radios organizadas de A a Z.');
  }

  async sortYoutubersAlphabetically() {
    if (!this.youtuberArray.length || this.isSavingYoutuberOrder) {
      return;
    }

    const previousOrder = this.youtuberArray.map(youtuber => youtuber.id);
    this.youtuberArray = [...this.youtuberArray].sort((a, b) =>
      this.compareLabels(a.title, b.title) ||
      this.compareLabels(a.channelId, b.channelId)
    );

    await this.saveYoutuberOrder(previousOrder, 'Youtubers organizados de A a Z.');
  }

  chipCreateForm() {
    if (this.isSavingChipOrder) {
      return;
    }

    const chipValue = this.chipCreate.value.chipname?.trim();

    if (!chipValue) {
      this.toastService.warning('Atencao!', 'Campo vazio', 5000);
      return;
    }

    const videoId = this.extractVideoId(chipValue);

    if (!videoId) {
      this.toastService.error('Erro!', 'Video invalido.', 5000);
      return;
    }

    if (this.chipArray.some(chip => chip.chipname === videoId)) {
      this.toastService.info('Radio', 'Este video ja esta cadastrado.', 5000);
      return;
    }

    this.isAddingChip = true;

    this.firebase.cadastrarChip(new Chip('', videoId, this.chipArray.length + 1))
      .then(ref => {
        this.chipCreate.reset();
        const newChip = new Chip(ref.id, videoId, this.chipArray.length + 1);
        this.populateVideoDetails(newChip);
        this.toastService.success('Sucesso!', 'Radio adicionada.', 5000);
      })
      .catch(() => this.toastService.error('Erro!', 'Nao foi possivel adicionar a radio.', 5000))
      .finally(() => this.isAddingChip = false);
  }

  youtuberCreateForm() {
    if (this.isSavingYoutuberOrder) {
      return;
    }

    const youtuberValue = this.youtuberCreate.value.youtuber?.trim();

    if (!youtuberValue) {
      this.toastService.warning('Atencao!', 'Campo vazio', 5000);
      return;
    }

    this.isAddingYoutuber = true;

    this.youtubeService.resolveChannel(youtuberValue).subscribe({
      next: channel => {
        this.firebase.cadastrarYoutuber({
          channelId: channel.channelId,
          title: channel.title,
          order: this.getNextYoutuberOrder(),
          handle: channel.handle,
          thumbnailUrl: channel.thumbnailUrl,
          createdAt: new Date().toISOString()
        })
          .then(result => {
            if (result.created) {
              this.youtuberCreate.reset();
              this.toastService.success('Sucesso!', 'Youtuber adicionado.', 5000);
              return;
            }

            this.toastService.info('Youtuber', 'Canal ja cadastrado.', 5000);
          })
          .catch(() => this.toastService.error('Erro!', 'Nao foi possivel salvar o youtuber.', 5000))
          .finally(() => this.isAddingYoutuber = false);
      },
      error: () => {
        this.isAddingYoutuber = false;
        this.toastService.error('Erro!', 'Canal nao encontrado.', 5000);
      }
    });
  }

  syncCurrentLives() {
    if (this.isSyncingLives || this.isSavingChipOrder || this.isSavingYoutuberOrder) {
      return;
    }

    if (!this.youtuberArray.length) {
      this.toastService.warning('Atencao!', 'Adicione um youtuber primeiro.', 5000);
      return;
    }

    this.isSyncingLives = true;

    this.youtubeService.getCurrentLivesForChannels(this.youtuberArray.map(youtuber => youtuber.channelId))
      .subscribe({
        next: lives => {
          if (!lives.length) {
            this.isSyncingLives = false;
            this.toastService.info('Lives', 'Nenhuma live ativa encontrada.', 5000);
            return;
          }

          this.firebase.cadastrarChipsEmLote(lives.map(live => live.videoId))
            .then(addedCount => {
              if (addedCount > 0) {
                this.toastService.success('Sucesso!', `${addedCount} live(s) adicionada(s).`, 5000);
                return;
              }

              this.toastService.info('Lives', 'As lives atuais ja estavam cadastradas.', 5000);
            })
            .catch(() => this.toastService.error('Erro!', 'Nao foi possivel adicionar as lives.', 5000))
            .finally(() => this.isSyncingLives = false);
        },
        error: () => {
          this.isSyncingLives = false;
          this.toastService.error('Erro!', 'Nao foi possivel buscar as lives.', 5000);
        }
      });
  }

  cleanNonWorkingLives() {
    if (this.isCleaningLives || this.isSavingChipOrder) {
      return;
    }

    if (!this.chipArray.length) {
      this.toastService.warning('Atencao!', 'Nao ha radios para verificar.', 5000);
      return;
    }

    Swal.fire({
      title: 'Verificar lives inativas?',
      text: 'Vou consultar o YouTube primeiro e mostrar uma confirmacao antes de remover qualquer item.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Verificar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.runNonWorkingLivesCleanup();
      }
    });
  }

  deleteYoutuber(id: string) {
    if (this.isSavingYoutuberOrder) {
      return;
    }

    Swal.fire({
      title: 'Excluir youtuber?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#dc2626',
      confirmButtonText: 'Excluir',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.firebase.excluirYoutuber(id)
          .then(() => this.toastService.success('Sucesso!', 'Youtuber excluido.', 5000));
      }
    });
  }

  deleteChip(id: string) {
    if (this.isSavingChipOrder) {
      return;
    }

    Swal.fire({
      title: 'Excluir radio?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#dc2626',
      confirmButtonText: 'Excluir',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.firebase.excluirChip(id)
          .then(() => this.toastService.success('Sucesso!', 'Radio excluida.', 5000));
      }
    });
  }

  goBack() {
    this.router.navigate(['']);
  }

  isQuotaExhausted(): boolean {
    return this.quotaStatus.toLowerCase().includes('exceeded');
  }

  logout() {
    Swal.fire({
      title: 'Sair do admin?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#dc2626',
      confirmButtonText: 'Sair',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.auth.deslogar();
        this.toastService.success('Sucesso!', 'Logout realizado.', 5000);
      }
    });
  }

  private initForms() {
    this.chipCreate = this.formBuilder.group({
      chipname: ['', Validators.required]
    });

    this.youtuberCreate = this.formBuilder.group({
      youtuber: ['', Validators.required]
    });
  }

  private loadChips() {
    const subscription = this.firebase.obterTodosChip().subscribe(res => {
      const chips = res.map(c => ({
          id: c.payload.doc.id,
          ...(c.payload.doc.data() as any)
        } as Chip));

      this.chipArray = this.sortByStoredOrder(
        chips,
        chip => chip.chipname
      );

      this.chipArray.forEach(chip => this.populateVideoDetails(chip));
    });

    this.subscriptions.add(subscription);
  }

  private loadYoutubers() {
    const subscription = this.firebase.obterTodosYoutubers().subscribe(res => {
      const youtubers = res.map(c => ({
          id: c.payload.doc.id,
          ...(c.payload.doc.data() as Omit<Youtuber, 'id'>)
        }));

      this.youtuberArray = this.sortByStoredOrder(
        youtubers,
        youtuber => youtuber.title || youtuber.channelId
      );
    });

    this.subscriptions.add(subscription);
  }

  private populateVideoDetails(chip: Chip) {
    this.youtubeService.getVideoDetails(chip.chipname)
      .subscribe((details: YouTubeVideoDetails) => {
        chip.title = details.title;
        chip.creator = details.creator;
      });
  }

  private runNonWorkingLivesCleanup() {
    this.isCleaningLives = true;

    this.youtubeService.getNonWorkingLiveVideoIds(this.chipArray.map(chip => chip.chipname))
      .subscribe({
        next: videoIds => {
          if (!videoIds.length) {
            this.isCleaningLives = false;
            this.toastService.info('Limpeza', 'Nenhuma live inativa encontrada.', 5000);
            return;
          }

          const videoIdsToDelete = new Set(videoIds);
          const chipIdsToDelete = this.chipArray
            .filter(chip => videoIdsToDelete.has(chip.chipname))
            .map(chip => chip.id);

          if (chipIdsToDelete.length === this.chipArray.length && this.chipArray.length > 1) {
            this.isCleaningLives = false;
            Swal.fire({
              title: 'Limpeza bloqueada',
              text: 'A verificacao marcou todos os itens para remocao. Por seguranca, nada foi removido.',
              icon: 'warning',
              confirmButtonColor: '#2563eb'
            });
            return;
          }

          this.confirmNonWorkingLivesRemoval(chipIdsToDelete);
        },
        error: () => {
          this.isCleaningLives = false;
          this.toastService.error('Erro!', 'Nao foi possivel verificar as lives.', 5000);
        }
      });
  }

  private confirmNonWorkingLivesRemoval(chipIdsToDelete: string[]) {
    Swal.fire({
      title: `${chipIdsToDelete.length} live(s) inativa(s) encontrada(s)`,
      text: 'Confirme para remover somente esses itens da playlist.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Remover',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) {
        this.isCleaningLives = false;
        return;
      }

      this.firebase.excluirChipsEmLote(chipIdsToDelete)
        .then(deletedCount => {
          if (deletedCount > 0) {
            this.toastService.success('Sucesso!', `${deletedCount} live(s) removida(s).`, 5000);
            return;
          }

          this.toastService.info('Limpeza', 'Nenhum item precisou ser removido.', 5000);
        })
        .catch(() => this.toastService.error('Erro!', 'Nao foi possivel remover as lives.', 5000))
        .finally(() => this.isCleaningLives = false);
    });
  }

  private async saveChipOrder(previousOrder: string[], successMessage?: string) {
    this.isSavingChipOrder = true;
    this.applySequentialOrder(this.chipArray);

    try {
      await this.firebase.atualizarOrdemChips(this.chipArray.map(chip => chip.id));
      if (successMessage) {
        this.toastService.success('Sucesso!', successMessage, 5000);
      }
    } catch {
      this.chipArray = this.restoreOrder(this.chipArray, previousOrder);
      this.applySequentialOrder(this.chipArray);
      this.toastService.error('Erro!', 'Nao foi possivel salvar a ordem das radios.', 5000);
    } finally {
      this.isSavingChipOrder = false;
    }
  }

  private async saveYoutuberOrder(previousOrder: string[], successMessage?: string) {
    this.isSavingYoutuberOrder = true;
    this.applySequentialOrder(this.youtuberArray);

    try {
      await this.firebase.atualizarOrdemYoutubers(this.youtuberArray.map(youtuber => youtuber.id));
      if (successMessage) {
        this.toastService.success('Sucesso!', successMessage, 5000);
      }
    } catch {
      this.youtuberArray = this.restoreOrder(this.youtuberArray, previousOrder);
      this.applySequentialOrder(this.youtuberArray);
      this.toastService.error('Erro!', 'Nao foi possivel salvar a ordem dos youtubers.', 5000);
    } finally {
      this.isSavingYoutuberOrder = false;
    }
  }

  private sortByStoredOrder<T extends { order?: number }>(items: T[], getLabel: (item: T) => string): T[] {
    const compareByLabel = (a: T, b: T) => this.compareLabels(getLabel(a), getLabel(b));
    const hasValidOrder = (item: T) => Number.isFinite(item.order) && (item.order || 0) > 0;
    const orderedItems = items.filter(hasValidOrder);

    if (!orderedItems.length) {
      return [...items].sort(compareByLabel);
    }

    if (orderedItems.length === items.length) {
      return [...items].sort((a, b) =>
        (a.order || 0) - (b.order || 0) || compareByLabel(a, b)
      );
    }

    const result: Array<T | undefined> = new Array(items.length);

    [...orderedItems]
      .sort((a, b) => (a.order || 0) - (b.order || 0) || compareByLabel(a, b))
      .forEach(item => {
        let index = Math.min(Math.max(Math.trunc(item.order || 1) - 1, 0), items.length - 1);

        while (index < result.length && result[index]) {
          index++;
        }

        if (index === result.length) {
          index = result.findIndex(entry => !entry);
        }

        result[index] = item;
      });

    const unorderedItems = items.filter(item => !hasValidOrder(item)).sort(compareByLabel);
    let unorderedIndex = 0;

    return Array.from(result, item => item || unorderedItems[unorderedIndex++]);
  }

  private applySequentialOrder<T extends { order?: number }>(items: T[]) {
    items.forEach((item, index) => item.order = index + 1);
  }

  private restoreOrder<T extends { id: string }>(items: T[], ids: string[]): T[] {
    const positions = new Map(ids.map((id, index) => [id, index]));

    return [...items].sort((a, b) =>
      (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );
  }

  private getChipSortLabel(chip: Chip): string {
    const title = chip.title?.trim();
    return title && title !== 'Temporarily unavailable' ? title : chip.chipname;
  }

  private compareLabels(a: string, b: string): number {
    return this.titleCollator.compare(a || '', b || '');
  }

  private getNextYoutuberOrder(): number {
    return Math.max(
      this.youtuberArray.length,
      ...this.youtuberArray.map(youtuber => youtuber.order || 0)
    ) + 1;
  }

  private getKeyboardMoveIndex(key: string, currentIndex: number, itemCount: number): number {
    switch (key) {
      case 'ArrowUp':
        return Math.max(0, currentIndex - 1);
      case 'ArrowDown':
        return Math.min(itemCount - 1, currentIndex + 1);
      case 'Home':
        return 0;
      case 'End':
        return itemCount - 1;
      default:
        return currentIndex;
    }
  }

  private ytStatus() {
    const subscription = this.youtubeService.getQuotaStatus()
      .subscribe(status => this.quotaStatus = status);

    this.subscriptions.add(subscription);
  }

  private fetchConnectedUsersCount() {
    const subscription = this.userService.getConnectedUsersCount()
      .subscribe(count => this.connectedUsersCount = count);

    this.subscriptions.add(subscription);
  }

  private extractVideoId(value: string): string | null {
    const trimmed = value.trim();
    const directVideoId = trimmed.match(/^[\w-]{11}$/)?.[0];

    if (directVideoId) {
      return directVideoId;
    }

    const parsedFromUrl = this.extractVideoIdFromUrl(trimmed);
    if (parsedFromUrl) {
      return parsedFromUrl;
    }

    return trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/))([\w-]{11})/)?.[1] || null;
  }

  private extractVideoIdFromUrl(value: string): string | null {
    const urlValue = /^https?:\/\//i.test(value) ? value : `https://${value}`;

    try {
      const url = new URL(urlValue);
      const host = url.hostname.replace(/^www\./, '');
      const segments = url.pathname.split('/').filter(Boolean);

      if (host === 'youtu.be') {
        return segments[0]?.match(/^[\w-]{11}$/)?.[0] || null;
      }

      if (!host.endsWith('youtube.com')) {
        return null;
      }

      const videoFromQuery = url.searchParams.get('v')?.match(/^[\w-]{11}$/)?.[0];
      if (videoFromQuery) {
        return videoFromQuery;
      }

      const videoSegment = segments.find((segment, index) =>
        ['embed', 'shorts', 'live'].includes(segments[index - 1]) && /^[\w-]{11}$/.test(segment)
      );

      return videoSegment || null;
    } catch {
      return null;
    }
  }
}
