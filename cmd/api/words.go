package main

import (
	"errors"
	"net/http"

	"mithrilTiles.abdulmoiz.net/internal/data"
	"mithrilTiles.abdulmoiz.net/internal/validator"
)

func (app *application) createWordHandler(w http.ResponseWriter, r *http.Request) {
	wordPackID, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	_, err = app.models.WordPacks.Get(wordPackID)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	var input struct {
		Text       string `json:"text"`
		Difficulty string `json:"difficulty"`
	}

	err = app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if input.Difficulty == "" {
		input.Difficulty = "medium"
	}

	word := &data.Word{
		WordPackID: wordPackID,
		Text:       input.Text,
		Difficulty: input.Difficulty,
	}

	v := validator.New()
	data.ValidateWord(v, word)
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	err = app.models.Words.Insert(word)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrDuplicateWord):
			v.AddError("text", "this word already exists in the word pack")
			app.failedValidationResponse(w, r, v.Errors)
		case errors.Is(err, data.ErrWordPackNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusCreated, envelope{"word": word}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) updateWordHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	word, err := app.models.Words.Get(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	var input struct {
		Text       *string `json:"text"`
		Difficulty *string `json:"difficulty"`
	}

	err = app.readJSON(w, r, &input)
	if err != nil {
		app.badRequestResponse(w, r, err)
		return
	}

	if input.Text != nil {
		word.Text = *input.Text
	}
	if input.Difficulty != nil {
		word.Difficulty = *input.Difficulty
	}

	v := validator.New()
	data.ValidateWord(v, word)
	if !v.Valid() {
		app.failedValidationResponse(w, r, v.Errors)
		return
	}

	err = app.models.Words.Update(word)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		case errors.Is(err, data.ErrDuplicateWord):
			v.AddError("text", "this word already exists in the word pack")
			app.failedValidationResponse(w, r, v.Errors)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{"word": word}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) deleteWordHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	err = app.models.Words.Delete(id)
	if err != nil {
		switch {
		case errors.Is(err, data.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}
		return
	}

	err = app.writeJSON(w, http.StatusOK, envelope{
		"message": "word successfully deleted",
	}, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
