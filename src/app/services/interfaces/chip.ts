export class Chip{
    private _id!: string;
    private _chipname!: string;
    private _order!: number;
    
    constructor(id: string, chipname: string){
        this._chipname = chipname;
        this._id = id;
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
    
}