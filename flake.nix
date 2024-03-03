{
  description = "Dev env for my blog";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodeVerion = pkgs.nodejs_20;
      in
      with pkgs; {
        devShells = {
          default = mkShell { buildInputs = [ nodeVerion ]; };
        };
      });
}
