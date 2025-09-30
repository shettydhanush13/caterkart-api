export class Apparel {
    apparelCode: string;
    sizes: Sizes;
    price: number;
    quantity: number;
}

export class Sizes {
    [x: string]: SizeObject;
}

export class SizeObject {
    id: string;
    price: number;
    quantity: number;
}