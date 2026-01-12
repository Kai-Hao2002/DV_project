#######
#
#######


# Makefile for compiling main.tex with dependencies in tum/

# Main targets
MAIN = main
BIB = references.bib
STY_DIR = tum/
FIGS_DIR = figs/
RESOURCES_DIR = tum/resources/

all: $(MAIN).pdf

# Rule to compile the LaTeX document
$(MAIN).pdf: $(MAIN).tex $(BIB) $(wildcard $(STY_DIR)*.sty) $(wildcard $(STY_DIR)*.cls) $(wildcard $(FIGS_DIR)*.pdf) $(wildcard $(RESOURCES_DIR)*)
	TEXINPUTS=.:$(STY_DIR): pdflatex $(MAIN).tex
	TEXINPUTS=.:$(STY_DIR): bibtex $(MAIN)
	TEXINPUTS=.:$(STY_DIR): pdflatex $(MAIN).tex
	TEXINPUTS=.:$(STY_DIR): pdflatex $(MAIN).tex
	$(MAKE) clean_aux

# Clean auxiliary files except .log and .pdf
.PHONY: clean_aux
clean_aux:
	rm -f $(MAIN).aux $(MAIN).bbl $(MAIN).blg $(MAIN).out $(MAIN).toc

# Clean up auxiliary files
.PHONY: clean
clean:
	rm -f $(MAIN).aux $(MAIN).bbl $(MAIN).blg $(MAIN).log $(MAIN).out $(MAIN).toc $(MAIN).pdf

# Clean everything, including PDF
.PHONY: cleanall
cleanall: clean
	rm -f $(MAIN).pdf