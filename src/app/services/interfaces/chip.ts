export class Chip {
    private _id!: string;
    private _chipname!: string;
    private _order!: number;
    private _creator!: string;
    public title?: string;
  
    constructor(
      id: string,
      chipname: string,
      order: number = 0,
      creator: string = ''
    ) {
      this._id = id;
      this._chipname = chipname;
      this._order = order;
      this._creator = creator;
    }
  
    public get id(): string {
      return this._id;
    }
  
    public set id(value: string) {
      this._id = value;
    }
  
    public get chipname(): string {
      return this._chipname;
    }
  
    public set chipname(value: string) {
      this._chipname = value;
    }
  
    public get order(): number {
      return this._order;
    }
  
    public set order(value: number) {
      this._order = value;
    }
  
    public get creator(): string {
      return this._creator;
    }
  
    public set creator(value: string) {
      this._creator = value;
    }
  }