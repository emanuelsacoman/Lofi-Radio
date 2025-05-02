import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, Validators, FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';

import { AuthService } from 'src/app/services/auth.service';
import { FirebaseService } from 'src/app/services/firebase.service';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';
import { YoutubeService, YouTubeVideoDetails } from 'src/app/services/youtube.service';
import { Chip } from 'src/app/services/interfaces/chip';

@Component({
  selector: 'app-adm',
  templateUrl: './adm.component.html',
  styleUrls: ['./adm.component.css']
})
export class AdmComponent implements OnInit, OnDestroy {
  chipCreate!: FormGroup;
  public chipArray: Chip[] = [];
  connectedUsersCount = 0;
  quotaStatus = '';
  countdown = '';
  private countdownInterval: any;

  constructor(
    private router: Router,
    private firebase: FirebaseService,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private auth: AuthService,
    private userService: UserService,
    private youtubeService: YoutubeService
  ) {
    this.loadChips();
  }

  ngOnInit() {
    this.initChipForm();
    this.fetchConnectedUsersCount();
    this.ytStatus();
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  private loadChips() {
    this.firebase.obterTodosChip().subscribe(res => {
      this.chipArray = res
        .map(c => ({
          id: c.payload.doc.id,
          ...(c.payload.doc.data() as any)
        } as Chip))
        .sort((a, b) => a.order - b.order);
      this.chipArray.forEach(chip => this.populateVideoDetails(chip));
    });
  }

  private populateVideoDetails(chip: Chip) {
    this.youtubeService.getVideoDetails(chip.chipname)
      .subscribe((details: YouTubeVideoDetails) => {
        chip.title = details.title;
        chip.creator = details.creator;
      });
  }

  onDrop(event: CdkDragDrop<Chip[]>) {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.chipArray, event.previousIndex, event.currentIndex);
    this.updateChipOrder();
  }

  private updateChipOrder() {
    this.chipArray.forEach((chip, idx) => {
      chip.order = idx + 1;
      this.firebase.atualizarChip(chip.id, { order: chip.order });
    });
  }

  ytStatus() {
    this.youtubeService.getQuotaStatus()
      .subscribe(status => this.quotaStatus = status);
  }

  private initChipForm() {
    this.chipCreate = this.formBuilder.group({
      chipname: ['', Validators.required]
    });
  }

  chipCreateForm() {
    const chipValue = this.chipCreate.value.chipname?.trim();
    if (!chipValue) {
      this.toastService.warning('Atenção!', 'Campo vazio', 5000);
      return;
    }
    const match = chipValue.match(/(?:youtu\.be\/|v=)([^&]+)/);
    if (!match?.[1]) {
      this.toastService.error('Erro!', 'Código de vídeo inválido.', 5000);
      return;
    }
    const videoId = match[1].trim();
    const newOrder = this.chipArray.length + 1;
    const newChip = new Chip('', videoId, newOrder);
    this.firebase.cadastrarChip(newChip)
      .then(ref => {
        this.chipCreate.reset();
        newChip.id = ref.id;
        this.populateVideoDetails(newChip);
      });
  }

  deleteChip(id: string) {
    Swal.fire({
      title: 'Tem certeza que deseja excluir este chip?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.firebase.excluirChip(id)
          .then(() => this.toastService.success('Sucesso!', 'Rádio excluída com sucesso', 5000));
      }
    });
  }

  goBack() {
    this.router.navigate(['']);
  }

  fetchConnectedUsersCount() {
    this.userService.getConnectedUsersCount()
      .subscribe(count => this.connectedUsersCount = count);
  }

  isQuotaExhausted(): boolean {
    return this.quotaStatus.toLowerCase().includes('exceeded');
  }

  logout() {
    Swal.fire({
      title: 'Tem certeza que deseja sair?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.auth.deslogar();
        this.toastService.success('Sucesso!', 'Logout realizado com sucesso', 5000);
      }
    });
  }
}
