package main

import (
	"context"
	"fmt"
	"mime/multipart"
	"os"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/joho/godotenv"
)

func (app *application) uploadToCloudinary(ctx context.Context, file multipart.File, header *multipart.FileHeader) (string, error) {
	godotenv.Load()
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")
	cloudName := os.Getenv("CLOUDINARY_CLOUD_NAME")
	cloudinaryURL := fmt.Sprintf(
		"cloudinary://%s:%s@%s",
		apiKey,
		apiSecret,
		cloudName,
	)
	cld, err := cloudinary.NewFromURL(cloudinaryURL)
	if err != nil {
		return "", err
	}
	uploadResult, err := cld.Upload.Upload(ctx, file, uploader.UploadParams{
		Folder:   "avatars",
		PublicID: header.Filename,
	})
	if err != nil {
		return "", err
	}
	return uploadResult.SecureURL, nil
}
