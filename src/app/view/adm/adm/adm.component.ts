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
import { FALLBACK_SITE_THEME, SiteTheme, SiteThemeColors } from 'src/app/services/interfaces/site-theme';

type ThemeColorField = {
  key: keyof SiteThemeColors;
  label: string;
};

@Component({
  selector: 'app-adm',
  templateUrl: './adm.component.html',
  styleUrls: ['./adm.component.css']
})
export class AdmComponent implements OnInit, OnDestroy {
  chipCreate!: FormGroup;
  youtuberCreate!: FormGroup;
  themeCreate!: FormGroup;

  public chipArray: Chip[] = [];
  public youtuberArray: Youtuber[] = [];
  public themeArray: SiteTheme[] = [];

  readonly themeColorFields: ThemeColorField[] = [
    { key: 'background', label: 'Fundo' },
    { key: 'primary', label: 'Principal' },
    { key: 'secondary', label: 'Secundaria' },
    { key: 'accent', label: 'Destaque' },
    { key: 'accentLight', label: 'Destaque claro' },
    { key: 'text', label: 'Texto' }
  ];

  connectedUsersCount = 0;
  quotaStatus = '';
  isAddingChip = false;
  isAddingYoutuber = false;
  isSyncingLives = false;
  isCleaningLives = false;
  isSavingTheme = false;
  themeSaveError = '';

  private subscriptions = new Subscription();

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
    this.loadThemes();
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

  trackByChipId(_: number, chip: Chip): string {
    return chip.id;
  }

  trackByYoutuberId(_: number, youtuber: Youtuber): string {
    return youtuber.id;
  }

  trackByThemeId(_: number, theme: SiteTheme): string {
    return theme.id;
  }

  get themePreviewStyles(): Record<string, string> {
    const defaultColors = FALLBACK_SITE_THEME.colors;

    return {
      '--preview-background': this.themeCreate?.get('background')?.value || defaultColors.background,
      '--preview-primary': this.themeCreate?.get('primary')?.value || defaultColors.primary,
      '--preview-secondary': this.themeCreate?.get('secondary')?.value || defaultColors.secondary,
      '--preview-accent': this.themeCreate?.get('accent')?.value || defaultColors.accent,
      '--preview-accent-light': this.themeCreate?.get('accentLight')?.value || defaultColors.accentLight,
      '--preview-text': this.themeCreate?.get('text')?.value || defaultColors.text
    };
  }

  onDrop(event: CdkDragDrop<Chip[]>) {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    moveItemInArray(this.chipArray, event.previousIndex, event.currentIndex);
    this.updateChipOrder();
  }

  chipCreateForm() {
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

  themeCreateForm() {
    if (this.themeCreate.invalid) {
      this.themeCreate.markAllAsTouched();
      this.toastService.warning('Atencao!', 'Preencha o nome e todas as cores.', 5000);
      return;
    }

    const name = this.themeCreate.value.name.trim();

    if (!name) {
      this.toastService.warning('Atencao!', 'Informe um nome para o tema.', 5000);
      return;
    }

    const normalizedName = name.toLocaleLowerCase();
    const themeAlreadyExists = this.themeArray
      .some(theme => theme.name.toLocaleLowerCase() === normalizedName);

    if (themeAlreadyExists) {
      this.toastService.info('Tema', 'Ja existe um tema com esse nome.', 5000);
      return;
    }

    this.isSavingTheme = true;
    this.themeSaveError = '';

    this.firebase.cadastrarTema({
      name,
      colors: {
        background: this.themeCreate.value.background,
        primary: this.themeCreate.value.primary,
        secondary: this.themeCreate.value.secondary,
        accent: this.themeCreate.value.accent,
        accentLight: this.themeCreate.value.accentLight,
        text: this.themeCreate.value.text
      },
      order: Math.max(0, ...this.themeArray.map(theme => theme.order || 0)) + 1,
      swatch: this.themeCreate.value.primary,
      createdAt: new Date().toISOString()
    })
      .then(() => {
        this.resetThemeForm();
        this.toastService.success('Sucesso!', 'Tema salvo no Firebase.', 5000);
      })
      .catch((error: unknown) => {
        console.error('Erro ao salvar tema no Firestore:', error);
        this.themeSaveError = this.getThemeSaveErrorMessage(error);
        this.toastService.error('Erro!', this.themeSaveError, 7000);
      })
      .finally(() => this.isSavingTheme = false);
  }

  deleteTheme(theme: SiteTheme) {
    Swal.fire({
      title: `Excluir o tema ${theme.name}?`,
      text: 'Ele deixara de aparecer no seletor de cores do site.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Excluir',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.firebase.excluirTema(theme.id)
          .then(() => this.toastService.success('Sucesso!', 'Tema excluido.', 5000))
          .catch(() => this.toastService.error('Erro!', 'Nao foi possivel excluir o tema.', 5000));
      }
    });
  }

  syncCurrentLives() {
    if (this.isSyncingLives) {
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
    if (this.isCleaningLives) {
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

    const defaultColors = FALLBACK_SITE_THEME.colors;
    const colorValidators = [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)];

    this.themeCreate = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(40)]],
      background: [defaultColors.background, colorValidators],
      primary: [defaultColors.primary, colorValidators],
      secondary: [defaultColors.secondary, colorValidators],
      accent: [defaultColors.accent, colorValidators],
      accentLight: [defaultColors.accentLight, colorValidators],
      text: [defaultColors.text, colorValidators]
    });
  }

  private loadChips() {
    const subscription = this.firebase.obterTodosChip().subscribe(res => {
      this.chipArray = res
        .map(c => ({
          id: c.payload.doc.id,
          ...(c.payload.doc.data() as any)
        } as Chip))
        .sort((a, b) => a.order - b.order);

      this.chipArray.forEach(chip => this.populateVideoDetails(chip));
    });

    this.subscriptions.add(subscription);
  }

  private loadYoutubers() {
    const subscription = this.firebase.obterTodosYoutubers().subscribe(res => {
      this.youtuberArray = res
        .map(c => ({
          id: c.payload.doc.id,
          ...(c.payload.doc.data() as Omit<Youtuber, 'id'>)
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
    });

    this.subscriptions.add(subscription);
  }

  private loadThemes() {
    const subscription = this.firebase.obterTodosTemas().subscribe(res => {
      this.themeArray = res
        .map(item => ({
          id: item.payload.doc.id,
          ...(item.payload.doc.data() as Omit<SiteTheme, 'id'>)
        }))
        .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
          || a.name.localeCompare(b.name));
    });

    this.subscriptions.add(subscription);
  }

  private resetThemeForm() {
    const defaultColors = FALLBACK_SITE_THEME.colors;
    this.themeCreate.reset({
      name: '',
      ...defaultColors
    });
  }

  private getThemeSaveErrorMessage(error: unknown): string {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

    if (code.includes('permission-denied')) {
      return 'O usuario atual nao tem permissao para gravar na colecao siteThemes.';
    }

    if (code.includes('unavailable')) {
      return 'O Firestore esta indisponivel. Verifique a conexao e bloqueadores do navegador.';
    }

    return code
      ? `Nao foi possivel salvar o tema (${code}).`
      : 'Nao foi possivel salvar o tema no Firebase.';
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

  private updateChipOrder() {
    this.chipArray.forEach((chip, idx) => {
      chip.order = idx + 1;
      this.firebase.atualizarChip(chip.id, { order: chip.order });
    });
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
