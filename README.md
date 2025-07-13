# AngularApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.0.0.

## Firebase Setup

This project uses Firebase for authentication. To set up Firebase:

1. Copy `src/environments/environment.template.ts` to `src/environments/environment.ts`
2. Fill in your Firebase configuration values in `environment.ts`
3. Never commit `environment.ts` to version control (it's already in `.gitignore`)

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.



## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
