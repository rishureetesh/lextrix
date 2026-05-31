export default class DomError extends Error {
  public message: string;
  public name: string;
  public stack!: string;

  constructor(message: string) {
    message = '[Lextron Dom] ' + message;
    super(message);
    this.message = message;
    this.name = this.constructor.name;
  }
}
