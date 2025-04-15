import { Component } from '@angular/core';
import { FormGroup, Validators, FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { FirebaseService } from 'src/app/services/firebase.service';
import { Chip } from 'src/app/services/interfaces/chip';
import { ToastService } from 'src/app/services/toast.service';
import { UserService } from 'src/app/services/user.service';
import { YoutubeService } from 'src/app/services/youtube.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-adm',
  templateUrl: './adm.component.html',
  styleUrls: ['./adm.component.css']
})
export class AdmComponent {
  chipCreate!: FormGroup;
  chipClass!: Chip;
  chipname!: string;
  public chipArray: Chip[] = [];

  connectedUsersCount: number = 0;

  quotaStatus: string = '';
  countdown: string = '';

  private countdownInterval: any;

  constructor(
    private router: Router,
    private firebase: FirebaseService,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private auth: AuthService,
    private userService: UserService,
    private youtubeService: YoutubeService
  ){
    this.firebase.obterTodosChip().subscribe((res) => {
      this.chipArray = res.map((chip) => {
        return {
          id: chip.payload.doc.id,
          ...(chip.payload.doc.data() as any),
        } as Chip;
      }).sort((a,b) => a.order - b.order);
    });
  }

  ngOnInit(){
    this.initChip();
    this.fetchConnectedUsersCount();
    this.ytStatus();  
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  ytStatus() {
    this.youtubeService.getQuotaStatus().subscribe((status) => {
      this.quotaStatus = status;
    });
  }

  initChip(){
    this.chipCreate = this.formBuilder.group({
      chipname: ['', Validators.required] 
    });
  }

  chipCreateForm() {
    const chipValue = this.chipCreate.get('chipname')?.value;
  
    if (!chipValue || chipValue.trim() === "") {
      console.warn("O campo 'chipname' está vazio ou inválido.");
      this.toastService.warning("Atenção!", "Campo vazio", 5000)
      return; 
    }
    
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/.*[?&]v=([^&]+)/;
    const match = chipValue.match(youtubeRegex);
  
    if (!match || !match[1]) {
      console.warn("O link fornecido não é válido ou não contém um código de vídeo do YouTube.");
      this.toastService.error("Erro!", "Código de vídeo inválido.", 5000)
      return;
    }
  
    const videoCode = match[1]; 
  
    const create: Chip = new Chip("", videoCode.trim());
    this.firebase.cadastrarChip(create);
    this.chipCreate.reset();
  }   

  goBack(){
    this.router.navigate([""]);
  }

  deleteChip(id: any) {
    Swal.fire({
      title: 'Tem certeza de que deseja excluir este chip?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.firebase.excluirChip(id)
          .then(() => {
            this.toastService.success("Sucesso!", "Rádio excluída com sucesso", 5000)
          })
          .catch((error) => {
            console.error('Erro ao excluir chip:', error);
            this.toastService.error("Erro!", "Erro ao excluir a rádio", 5000)
          });
        }
    });
  }

  logout() {
    Swal.fire({
      title: 'Tem certeza de que deseja sair?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        try {
          this.auth.deslogar();
          this.toastService.success("Sucesso!", "Logout realizado com sucesso", 5000);
        } catch (error) {
          console.error('Erro ao deslogar:', error);
          this.toastService.error("Erro!", "Erro ao realizar logout", 5000);
        }
      }
    });
  }  

  fetchConnectedUsersCount() {
    this.userService.getConnectedUsersCount().subscribe(count => {
      this.connectedUsersCount = count;
    });
  }

  isQuotaExhausted(): boolean {
    return this.quotaStatus.toLowerCase().includes('exceeded');
  }

}
